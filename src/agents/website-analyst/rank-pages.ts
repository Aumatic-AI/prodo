import type { PageLink } from "@/providers/crawl/firecrawl";

// Picks the pages worth reading, by URL alone (no AI): home, offerings, pricing, about, proof, FAQ.

const RULES: [RegExp, number][] = [
  [/\/(products?|shop|store|collections?|catalog(ue)?|menu)(\/|$)/, 80],
  [/\/(services?|treatments?|solutions?|what-we-do|offerings?|courses?|classes)(\/|$)/, 80],
  [/\/(pricing|prices|plans|packages|rates|fees)(\/|$)/, 78],
  [/\/(offers?|deals|sale|promotions?|specials)(\/|$)/, 72],
  [/\/(about|about-us|our-story|my-story|story|team|who-we-are|company)(\/|$)/, 70],
  [/\/(reviews?|testimonials?|case-stud(y|ies)|results|portfolio|work|projects|clients|(my-|happy-)?customers)(\/|$)/, 70],
  [/\/(faqs?|help|questions)(\/|$)/, 65],
  [/\/(contact|locations?|book(ing)?|appointments?|visit)(\/|$)/, 40],
  // Shipping and returns pages hold rules customers must be told (customs, duties)
  [/\/(shipping|delivery|returns?|refunds?)[\w-]*(\/|$)/, 35],
];

const SKIP =
  /\/(cart|checkout|basket|account|my-account|login|log-in|signin|sign-in|register|signup|wp-admin|wp-json|wp-content|feed|tag|tags|author|search|cdn-cgi)(\/|$)|\/[\w-]*sitemap[\w-]*(\/|$)|\/(privacy|terms|cookie|legal|accessibility)[\w-]*(\/|$)|\.(jpe?g|png|gif|webp|svg|ico|pdf|zip|xml|json|txt|md|css|js|mp4|mov)$/i;
const BLOG = /\/(blog|news|articles?|posts?|stories|journal|press)\//i;

/** One product or service: useful but capped so they don't crowd out the rest */
const MAX_DETAIL_PAGES = 4;
/** One collection or category: they repeat the same products, so only a few */
const MAX_LISTING_PAGES = 3;
const DETAIL = /\/(products?|services?|treatments?|courses?|classes)\/[^/]+$/;
const LISTING = /\/(collections?|catalog(ue)?|shop|store|categor(y|ies)|menu)\/[^/]+$/;

type Kind = "detail" | "listing" | "page";

/** Host without www and path without a trailing slash, so http/https and "/about/" duplicates collapse. */
function parts(url: string): { host: string; path: string } | null {
  try {
    const u = new URL(/^https?:\/\//.test(url) ? url : `https://${url}`);
    return {
      host: u.hostname.replace(/^www\./, "").toLowerCase(),
      path: u.pathname.replace(/\/+$/, ""),
    };
  } catch {
    return null;
  }
}

// Kind comes from the URL's shape, not its depth: shops keep plain pages under a folder too
// (Shopify's /pages/contact is a contact page, not a detail page)
function score(path: string): { score: number; kind: Kind } {
  if (path === "" || path === "/") return { score: 100, kind: "page" };
  const depth = path.split("/").filter(Boolean).length;
  if (BLOG.test(`${path}/`)) return { score: 5, kind: "page" };
  // A sale or offers page holds the deals, even when the shop files it as a collection
  if (/\/(offers?|deals|sale|promotions?|specials)(\/|$)/.test(path)) return { score: 72, kind: "page" };
  const kind: Kind = DETAIL.test(path) ? "detail" : LISTING.test(path) ? "listing" : "page";
  for (const [pattern, base] of RULES) {
    if (!pattern.test(path)) continue;
    // "/products" (all of them) beats one collection, which beats one product
    return { score: base - (kind === "detail" ? 6 : kind === "listing" ? 4 : 0), kind };
  }
  return { score: Math.max(1, 30 - depth * 8), kind };
}

/** Up to `limit` page URLs from the site map, best first. Only pages on the client's own site. */
export function rankPages(website: string, links: PageLink[], limit: number): string[] {
  const home = parts(website);
  if (!home) return [];

  const seen = new Set<string>();
  const ranked: { url: string; score: number; kind: Kind }[] = [];
  for (const link of [{ url: website }, ...links]) {
    const page = parts(link.url);
    const key = page && `${page.host}${page.path.toLowerCase()}`;
    if (!page || !key || seen.has(key)) continue;
    seen.add(key);
    if (page.host !== home.host || SKIP.test(page.path)) continue;
    ranked.push({ url: link.url, ...score(page.path) });
  }

  ranked.sort((a, b) => b.score - a.score);
  const picked: string[] = [];
  const taken: Record<Kind, number> = { detail: 0, listing: 0, page: 0 };
  const cap: Record<Kind, number> = { detail: MAX_DETAIL_PAGES, listing: MAX_LISTING_PAGES, page: Infinity };
  for (const page of ranked) {
    if (picked.length >= limit) break;
    if (taken[page.kind] >= cap[page.kind]) continue;
    taken[page.kind]++;
    picked.push(page.url);
  }
  return picked;
}

/** Markdown with the clutter removed: image tags, empty links and long blank runs. */
export function cleanMarkdown(markdown: string): string {
  return markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[\s*\]\([^)]*\)/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
