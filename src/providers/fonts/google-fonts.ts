import { request } from "@/providers/http";
import { fontKey } from "@/providers/storage/paths";
import { download, upload } from "@/providers/storage/r2";

// Brand fonts for our own rendering (Satori ads, burned-in video captions). Google Fonts serves
// TrueType to plain requests; each file is kept in our storage (shared/fonts/…) so it's fetched once.

const SERVICE = "Google Fonts";
const memory = new Map<string, Promise<FontFile | null>>();

export interface FontFile {
  family: string;
  weight: number;
  data: ArrayBuffer;
  /** Storage key of the .ttf (for the video renderer) */
  key: string;
}

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function fromGoogle(family: string, weight: number): Promise<ArrayBuffer | null> {
  const name = encodeURIComponent(family).replace(/%20/g, "+");
  // Ask for the weight; families without it answer 400, so fall back to their default
  for (const query of [`family=${name}:wght@${weight}`, `family=${name}`]) {
    const css = await request(SERVICE, `https://fonts.googleapis.com/css2?${query}`, {}, 15_000).catch(() => null);
    if (!css?.ok) continue;
    const url = (await css.text()).match(/src:\s*url\((https:[^)]+\.ttf)\)/)?.[1];
    if (!url) continue;
    const file = await request(SERVICE, url, {}, 30_000).catch(() => null);
    if (file?.ok) return file.arrayBuffer();
  }
  return null;
}

async function loadOnce(family: string, weight: number): Promise<FontFile | null> {
  const key = fontKey(`${slug(family)}-${weight}.ttf`);
  const cached = await download(key).catch(() => null);
  if (cached) return { family, weight, data: cached, key };
  const data = await fromGoogle(family, weight);
  if (!data) return null;
  await upload(key, Buffer.from(data), "font/ttf").catch(() => undefined);
  return { family, weight, data, key };
}

/** The family at that weight, or null when Google Fonts doesn't have it (callers fall back). */
export function loadFont(family: string, weight: number): Promise<FontFile | null> {
  const id = `${family}|${weight}`;
  let pending = memory.get(id);
  if (!pending) {
    pending = loadOnce(family, weight)
      .catch(() => null)
      .then((font) => {
        // Try again next time instead of remembering a failure
        if (!font) memory.delete(id);
        return font;
      });
    memory.set(id, pending);
  }
  return pending;
}
