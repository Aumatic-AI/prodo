import type { SupabaseClient } from "@supabase/supabase-js";
import { SOCIAL_PLATFORMS } from "@/core/onboarding/options";
import { request } from "@/providers/http";
import { ownRow } from "@/lib/supabase/own-row";

// Social profile links the client didn't fill in, taken from their own website (usually the footer).
// Plain code: one download of the homepage, no AI and no paid service. Only empty fields are filled;
// what the client typed is never changed.

type SocialPlatform = (typeof SOCIAL_PLATFORMS)[number];

const MAX_HTML_CHARS = 2_000_000;
const TIMEOUT_MS = 20_000;

/** Profile link patterns per platform (share buttons, posts and embeds don't match). */
const PROFILE: Record<SocialPlatform, { hosts: RegExp; path: RegExp }> = {
  instagram: { hosts: /(^|\.)instagram\.com$/, path: /^\/(?!p\/|reels?\/|explore\/|stories\/|accounts\/)([A-Za-z0-9._]{2,30})\/?$/ },
  facebook: { hosts: /(^|\.)(facebook|fb)\.com$/, path: /^\/(?!sharer|share|dialog|plugins|tr\b|login|groups\/|events\/|photo|watch)([A-Za-z0-9.\-]{2,80}|profile\.php)\/?$/ },
  youtube: { hosts: /(^|\.)youtube\.com$/, path: /^\/(@[A-Za-z0-9._-]{2,60}|channel\/[A-Za-z0-9_-]{10,}|c\/[A-Za-z0-9._-]+|user\/[A-Za-z0-9._-]+)\/?$/ },
  linkedin: { hosts: /(^|\.)linkedin\.com$/, path: /^\/(company|in|school|showcase)\/[A-Za-z0-9._%-]{2,100}\/?$/ },
  tiktok: { hosts: /(^|\.)tiktok\.com$/, path: /^\/@[A-Za-z0-9._]{2,30}\/?$/ },
  twitter: { hosts: /(^|\.)(twitter|x)\.com$/, path: /^\/(?!intent\/|share|home\b|search|hashtag\/|i\/)([A-Za-z0-9_]{1,15})\/?$/ },
  pinterest: { hosts: /(^|\.)pinterest\.[a-z.]+$/, path: /^\/(?!pin\/|search\/|_\/)([A-Za-z0-9_]{3,30})\/?$/ },
  threads: { hosts: /(^|\.)threads\.(net|com)$/, path: /^\/@[A-Za-z0-9._]{2,30}\/?$/ },
};

/** First profile link per platform found in the page's links. */
export function findSocialLinks(html: string): Partial<Record<SocialPlatform, string>> {
  const found: Partial<Record<SocialPlatform, string>> = {};
  for (const match of html.matchAll(/href\s*=\s*["']([^"'#\s]+)["']/gi)) {
    let url: URL;
    try {
      url = new URL(match[1].replace(/&amp;/g, "&"));
    } catch {
      continue;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") continue;
    const host = url.hostname.replace(/^(www|m|mobile)\./, "");
    for (const platform of SOCIAL_PLATFORMS) {
      if (found[platform]) continue;
      const rule = PROFILE[platform];
      if (!rule.hosts.test(host) || !rule.path.test(url.pathname)) continue;
      // profile.php keeps its id; every other link loses its tracking query
      const query = url.pathname.startsWith("/profile.php") && url.searchParams.get("id") ? `?id=${url.searchParams.get("id")}` : "";
      found[platform] = `https://${host === "fb.com" ? "facebook.com" : host}${url.pathname.replace(/\/$/, "")}${query}`;
    }
  }
  return found;
}

async function homepageHtml(website: string): Promise<string | null> {
  if (!/^https?:\/\//i.test(website)) return null;
  const res = await request("The website", website, { headers: { "User-Agent": "Mozilla/5.0 (compatible; ProdoBot/1.0)", Accept: "text/html" } }, TIMEOUT_MS);
  if (!res.ok || !(res.headers.get("content-type") ?? "").includes("html")) return null;
  return (await res.text()).slice(0, MAX_HTML_CHARS);
}

/**
 * Fills the empty social profile fields from the business's homepage and saves them.
 * Returns only the links it added (empty when nothing was missing or nothing was found).
 */
export async function fillSocialsFromWebsite(db: SupabaseClient, website: string | null, socials: Record<string, string>): Promise<Record<string, string>> {
  const missing = SOCIAL_PLATFORMS.filter((p) => !socials[p]?.trim());
  if (!website || !missing.length) return {};

  const html = await homepageHtml(website);
  if (!html) return {};
  const links = findSocialLinks(html);
  const added = Object.fromEntries(missing.filter((p) => links[p]).map((p) => [p, links[p]!]));
  if (!Object.keys(added).length) return {};

  // Read again just before saving, so a link the client typed meanwhile is kept
  const { data, error } = await db.from("business_profile").select("social_urls").single();
  if (error) throw error;
  const current: Record<string, string> = data.social_urls ?? {};
  const fresh = Object.fromEntries(Object.entries(added).filter(([p]) => !current[p]?.trim()));
  if (!Object.keys(fresh).length) return {};
  const { error: saveError } = await ownRow(db.from("business_profile").update({ social_urls: { ...current, ...fresh } }));
  if (saveError) throw saveError;
  return fresh;
}
