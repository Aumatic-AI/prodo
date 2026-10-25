import type { ReadablePlatform } from "./types";

// Profile handles from the links clients paste ("https://instagram.com/acme", "@acme", "acme").

const PATTERNS: Record<ReadablePlatform, RegExp> = {
  instagram: /instagram\.com\/([A-Za-z0-9._]+)/i,
  tiktok: /tiktok\.com\/@([A-Za-z0-9._]+)/i,
  youtube: /youtube\.com\/@([A-Za-z0-9._-]+)/i,
};

const RESERVED = new Set(["p", "reel", "reels", "explore", "stories", "channel", "c", "user", "watch"]);

export function handleFromUrl(platform: ReadablePlatform, value: string | null | undefined): string | null {
  const text = (value ?? "").trim();
  if (!text) return null;
  const match = text.match(PATTERNS[platform]);
  const handle = match?.[1] ?? (/^@?[A-Za-z0-9._-]+$/.test(text) ? text.replace(/^@/, "") : null);
  return handle && !RESERVED.has(handle.toLowerCase()) ? handle : null;
}

/** "https://www.acme.co.uk/shop" → "acme.co.uk" */
export function domainOf(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(/^https?:\/\//.test(url) ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}
