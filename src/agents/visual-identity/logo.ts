import sharp from "sharp";
import { Vibrant } from "node-vibrant/node";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIMITS } from "@/config/limits";
import { AppError } from "@/core/errors";
import { request } from "@/providers/http";
import { businessKey, upload } from "@/providers/storage/supabase-storage";
import { luminance, toHex } from "@/lib/color";

// Logo colours and versions for light and dark backgrounds. Code only.

export interface LogoAnalysis {
  /** Most used colours first */
  palette: string[];
  /** Has see-through pixels, so it can sit on any background */
  transparent: boolean;
  /** Average brightness of the visible pixels, 0 (black) to 1 (white) */
  brightness: number;
}

export async function downloadImage(url: string): Promise<Buffer> {
  const res = await request("Storage", url, {}, LIMITS.fetchTimeoutMs);
  if (!res.ok) throw new AppError("Couldn't open the logo file. Upload it again in Basics.", "INVALID_INPUT", false);
  return Buffer.from(await res.arrayBuffer());
}

export async function analyzeLogo(image: Buffer): Promise<LogoAnalysis> {
  const palette = await Vibrant.from(image).getPalette();
  const swatches = Object.values(palette)
    .filter((s): s is NonNullable<typeof s> => !!s)
    .sort((a, b) => b.population - a.population)
    .map((s) => toHex(...(s.rgb as [number, number, number])));

  const { data, info } = await sharp(image).ensureAlpha().resize(200, 200, { fit: "inside" }).raw().toBuffer({ resolveWithObject: true });
  let visible = 0;
  let clear = 0;
  let light = 0;
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i + 3] < 128) {
      clear++;
      continue;
    }
    visible++;
    light += luminance(toHex(data[i], data[i + 1], data[i + 2]));
  }
  return {
    palette: [...new Set(swatches)],
    transparent: clear > visible * 0.05,
    brightness: visible ? light / visible : 1,
  };
}

/** The logo with every visible pixel in one colour, keeping its shape (for dark or busy backgrounds). */
async function recolor(image: Buffer, hex: string): Promise<Buffer> {
  const { data, info } = await sharp(image).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  for (let i = 0; i < data.length; i += 4) {
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
  return sharp(data, {
    raw: { width: info.width, height: info.height, channels: 4 },
  })
    .png()
    .toBuffer();
}

export interface LogoVariants {
  /** The original upload */
  full: string;
  /** Use on light backgrounds */
  light: string;
  /** Use on dark backgrounds (null when the logo has a solid background and can't be recoloured) */
  dark: string | null;
}

/**
 * Logo versions as storage keys. Only logos with transparency can be recoloured;
 * a logo on a solid box is used as it is everywhere.
 */
export async function makeLogoVariants(db: SupabaseClient, businessId: string, image: Buffer, logoKey: string, analysis: LogoAnalysis, darkText: string): Promise<LogoVariants> {
  if (!analysis.transparent) return { full: logoKey, light: logoKey, dark: null };

  const stamp = Date.now();
  const save = async (name: string, png: Buffer) => {
    const key = businessKey(businessId, `logo/variants/${stamp}-${name}.png`);
    await upload(db, key, png, "image/png");
    return key;
  };

  // A mostly white logo disappears on white, so the light-background version is recoloured dark
  const light = analysis.brightness > 0.8 ? await save("on-light", await recolor(image, darkText)) : logoKey;
  // A mostly dark logo disappears on dark, so the dark-background version is white
  const dark = analysis.brightness < 0.35 ? await save("on-dark", await recolor(image, "#ffffff")) : logoKey;
  return { full: logoKey, light, dark };
}
