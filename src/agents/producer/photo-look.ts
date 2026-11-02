import sharp from "sharp";
import { MODELS } from "@/config/models";
import type { LogoCorner } from "@/core/creative/brief";
import { DEFAULT_LOOK, type PhotoLook } from "@/creative/templates/ads";
import { PHOTO_LAYOUT_PROMPT, PHOTO_LAYOUT_SYSTEM, photoLayoutSchema } from "@/prompts/agents/photo-layout";
import { ai } from "@/providers/ai/registry";
import { request } from "@/providers/http";
import type { Usage } from "@/providers/usage";

// Where the words go on an image ad: one vision call finds the subject and the calm band, and code
// measures how light the top and bottom edges are (for the shade and the logo).

const clamp = (v: number) => Math.min(1, Math.max(0, v));

export async function photoLook(url: string): Promise<{ look: PhotoLook; usage: Usage }> {
  const [res, tones] = await Promise.all([ai.structured(photoLayoutSchema, PHOTO_LAYOUT_PROMPT, { system: PHOTO_LAYOUT_SYSTEM, images: [url], model: MODELS.vision }), edgeTones(url)]);
  const found = res.data.scenes[0];
  const subject = found?.subject ?? null;
  const focus = subject ? { x: clamp(subject.x + subject.w / 2), y: clamp(subject.y + subject.h / 2) } : DEFAULT_LOOK.focus;
  // "middle" means neither edge is calm: the words go on the edge farther from the subject
  const zone: PhotoLook["zone"] = found?.textZone === "top" ? "top" : found?.textZone === "bottom" ? "bottom" : focus.y > 0.5 ? "top" : "bottom";
  const zoneLight = found?.textZone === zone ? !!found.light : zone === "top" ? tones.top : tones.bottom;
  return { look: { zone, zoneLight, topLight: tones.top, bottomLight: tones.bottom, focus }, usage: res.usage };
}

/** Whether the picture behind a logo in this corner is light (average brightness over 55%). */
export async function cornerIsLight(url: string, corner: LogoCorner): Promise<boolean> {
  const res = await request("File storage", url, {}, 30_000);
  if (!res.ok) return false;
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(40, 50, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  // The corner's patch: 35% across, 20% down
  const w = Math.round(info.width * 0.35);
  const h = Math.round(info.height * 0.2);
  const x0 = corner.endsWith("right") ? info.width - w : 0;
  const y0 = corner.startsWith("bottom") ? info.height - h : 0;
  let sum = 0;
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) sum += data[y * info.width + x];
  return sum / (w * h) / 255 > 0.55;
}

/** Whether the top and bottom fifths of the photo are light (average brightness over 60%). */
async function edgeTones(url: string): Promise<{ top: boolean; bottom: boolean }> {
  const res = await request("File storage", url, {}, 30_000);
  if (!res.ok) return { top: false, bottom: false };
  const { data, info } = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(20, 25, { fit: "fill" })
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const mean = (fromRow: number, toRow: number) => {
    let sum = 0;
    for (let y = fromRow; y < toRow; y++) for (let x = 0; x < info.width; x++) sum += data[y * info.width + x];
    return sum / ((toRow - fromRow) * info.width) / 255;
  };
  const band = Math.max(1, Math.round(info.height / 5));
  return { top: mean(0, band) > 0.6, bottom: mean(info.height - band, info.height) > 0.6 };
}
