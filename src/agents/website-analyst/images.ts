import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { LIMITS } from "@/config/limits";
import { request } from "@/providers/http";
import { brandKey } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";

// Logo and product photos taken from the client's own website during the onboarding scan.
// Plain code: downloads, checks and resizes the images, then stores them in the business's folder.

const TIMEOUT_MS = 20_000;
const MAX_HTML_CHARS = 2_000_000;
/** Product photos smaller than this on their short side are thumbnails or icons */
const MIN_PHOTO_PX = 300;
const MAX_PHOTO_PX = 2000;
const MAX_LOGO_PX = 1000;
const HEADERS = { "User-Agent": "Mozilla/5.0 (compatible; ProdoBot/1.0)" };

/** The homepage HTML, or null when the site doesn't return a page. */
export async function fetchHtml(url: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(url)) return null;
  const res = await request("The website", url, { headers: { ...HEADERS, Accept: "text/html" } }, TIMEOUT_MS);
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
  return (await res.text()).slice(0, MAX_HTML_CHARS);
}

async function fetchImage(url: string): Promise<Buffer | null> {
  const res = await request("The website", url, { headers: { ...HEADERS, Accept: "image/*" } }, TIMEOUT_MS);
  if (!res.ok || !(res.headers.get("content-type") ?? "").startsWith("image/")) return null;
  const buffer = Buffer.from(await res.arrayBuffer());
  return buffer.length > LIMITS.imageMaxBytes ? null : buffer;
}

function absolute(url: string, pageUrl: string): string | null {
  try {
    const u = new URL(url.replace(/&amp;/g, "&"), pageUrl);
    return u.protocol === "https:" || u.protocol === "http:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/** Image links from one schema.org Product (a string, a list, or objects with a url). */
function productImages(node: unknown): string[] {
  const list = Array.isArray(node) ? node : [node];
  return list.flatMap((i) =>
    typeof i === "string" ? [i] : i && typeof i === "object" && typeof (i as { url?: unknown }).url === "string" ? [(i as { url: string }).url] : []
  );
}

const isProduct = (node: unknown) => {
  const type = (node as { "@type"?: unknown } | null)?.["@type"];
  return type === "Product" || (Array.isArray(type) && type.includes("Product"));
};

/** Every photo of a Shopify product, from the free "/products/<handle>.js" version of its page. */
async function shopifyImages(pageUrl: string): Promise<string[]> {
  const url = new URL(pageUrl);
  if (!/\/products\/[^/]+$/.test(url.pathname)) return [];
  const res = await request("The website", `${url.origin}${url.pathname}.js`, { headers: HEADERS }, TIMEOUT_MS).catch(() => null);
  if (!res?.ok) return [];
  const data = (await res.json().catch(() => null)) as { images?: unknown } | null;
  return Array.isArray(data?.images) ? data.images.filter((i): i is string => typeof i === "string") : [];
}

/**
 * A product's photos from its own page: the schema.org Product data shops publish for search
 * engines (Shopify, WooCommerce and most others), else the page's share image. Free: a plain fetch.
 */
export async function findProductImages(pageUrl: string): Promise<string[]> {
  const html = await fetchHtml(pageUrl).catch(() => null);
  if (!html) return [];
  const found: string[] = [];
  for (const block of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown;
    try {
      data = JSON.parse(block[1]);
    } catch {
      continue;
    }
    const top = Array.isArray(data) ? data : [data];
    const nodes = top.flatMap((d) => {
      const graph = (d as { "@graph"?: unknown } | null)?.["@graph"];
      return Array.isArray(graph) ? graph : [d];
    });
    for (const node of nodes) if (isProduct(node)) found.push(...productImages((node as { image?: unknown }).image));
  }
  // Shopify lists only the first photo there; its product page also comes as JSON with every photo
  if (found.length < 2 && /cdn\/shop|shopify/i.test(html)) found.push(...(await shopifyImages(pageUrl)));
  if (!found.length) {
    const og = html.match(/<meta[^>]+property=["']og:image(?::secure_url)?["'][^>]+content=["']([^"']+)["']/i)?.[1];
    if (og) found.push(og);
  }
  const links = found.map((u) => absolute(u.startsWith("//") ? `https:${u}` : u, pageUrl)).filter((u): u is string => !!u);
  return [...new Set(links)];
}

/** The logo image on the page: an <img> whose link, alt text, class or id says "logo" (headers come first in the HTML). */
export function findLogoUrl(html: string, pageUrl: string): string | null {
  for (const match of html.matchAll(/<img\b[^>]*>/gi)) {
    const tag = match[0];
    if (!/logo/i.test(tag)) continue;
    const src = tag.match(/\s(?:data-)?src\s*=\s*["']([^"']+)["']/i)?.[1] ?? tag.match(/\ssrcset\s*=\s*["']([^"'\s,]+)/i)?.[1];
    if (!src || src.startsWith("data:")) continue;
    const url = absolute(src.startsWith("//") ? `https:${src}` : src, pageUrl);
    if (url) return url;
  }
  return null;
}

/** Downloads the logo, turns it into a PNG and stores it. Returns the storage key, or null when it isn't usable. */
export async function saveLogo(businessId: string, url: string): Promise<string | null> {
  const image = await fetchImage(url);
  if (!image) return null;
  const png = await sharp(image, { density: 300 })
    .resize(MAX_LOGO_PX, MAX_LOGO_PX, { fit: "inside", withoutEnlargement: true })
    .png()
    .toBuffer()
    .catch(() => null);
  if (!png) return null;
  const { width = 0, height = 0 } = await sharp(png).metadata();
  if (Math.min(width, height) < 16) return null;
  const key = brandKey(businessId, "logo", randomUUID(), "png");
  await upload(key, png, "image/png");
  return key;
}

/**
 * Downloads one product's photos and stores them. Images that are too small or can't be read are
 * skipped; repeats of the same file in other sizes are dropped by link. Returns each photo's
 * brand_assets id (its file is named by it) and storage key.
 */
export async function saveProductPhotos(businessId: string, urls: string[], max: number): Promise<{ id: string; key: string }[]> {
  const seen = new Set<string>();
  const keys: { id: string; key: string }[] = [];
  for (const url of urls) {
    if (keys.length >= max) break;
    // Shops serve the same photo at many sizes: compare without the size query
    const base = url.split("?")[0].replace(/_\d+x\d*(?=\.\w+$)/, "");
    if (seen.has(base)) continue;
    seen.add(base);

    const image = await fetchImage(url).catch(() => null);
    if (!image) continue;
    const meta = await sharp(image)
      .metadata()
      .catch(() => null);
    if (!meta?.width || !meta.height || Math.min(meta.width, meta.height) < MIN_PHOTO_PX) continue;

    const resized = sharp(image).rotate().resize(MAX_PHOTO_PX, MAX_PHOTO_PX, { fit: "inside", withoutEnlargement: true });
    const [file, ext, type] = meta.hasAlpha
      ? [await resized.png().toBuffer(), "png", "image/png"]
      : [await resized.jpeg({ quality: 88 }).toBuffer(), "jpg", "image/jpeg"];
    const id = randomUUID();
    const key = brandKey(businessId, "photos", id, ext);
    await upload(key, file, type);
    keys.push({ id, key });
  }
  return keys;
}
