import type { PageLink } from "@/providers/crawl/firecrawl";

// Picks the pages worth reading, by URL alone (no AI): home, offerings, pricing, about, proof, FAQ.

const RULES: [RegExp, number][] = [
  [/\/(products?|shop|store|collections?|catalog(ue)?|menu)(\/|$)/, 80],
  [/\/(services?|treatments?|solutions?|what-we-do|offerings?|courses?|classes)(\/|$)/, 80],
  [/\/(pricing|prices|plans|packages|rates|fees)(\/|$)/, 78],
  [/\/(offers?|deals|sale|promotions?|specials)(\/|$)/, 72],
  [/\/(about|about-us|our-story|story|team|who-we-are|company)(\/|$)/, 70],
  [/\/(reviews?|testimonials?|case-stud(y|ies)|results|portfolio|work|projects|clients)(\/|$)/, 70],
  [/\/(faqs?|help|questions)(\/|$)/, 65],
  [/\/(contact|locations?|book(ing)?|appointments?|visit)(\/|$)/, 40],
];

const SKIP =
  /\/(cart|checkout|basket|account|my-account|login|log-in|signin|sign-in|register|signup|wp-admin|wp-json|wp-content|feed|tag|tags|author|search|sitemap|cdn-cgi)(\/|$)|\/(privacy|terms|cookie|legal|refund|returns-policy|shipping-policy)[\w-]*(\/|$)|\.(jpe?g|png|gif|webp|svg|ico|pdf|zip|xml|json|txt|css|js|mp4|mov)$/i;
const BLOG = /\/(blog|news|articles?|posts?|stories|journal|press)\//i;

/** Detail pages (one product or service) are useful but capped so they don't crowd out the rest. */
const MAX_DETAIL_PAGES = 12;

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

function score(path: string): { score: number; detail: boolean } {
  if (path === "" || path === "/") return { score: 100, detail: false };
  const depth = path.split("/").filter(Boolean).length;
  if (BLOG.test(`${path}/`)) return { score: 5, detail: false };
  for (const [pattern, base] of RULES) {
    if (!pattern.test(path)) continue;
    // "/products" (listing) beats "/products/blue-mug" (detail)
    const detail = depth > 1;
    return { score: base - (depth - 1) * 6, detail };
  }
  return { score: Math.max(1, 30 - depth * 8), detail: false };
}

/** Up to `limit` page URLs from the site map, best first. Only pages on the client's own site. */
export function rankPages(website: string, links: PageLink[], limit: number): string[] {
  const home = parts(website);
  if (!home) return [];

  const seen = new Set<string>();
  const ranked: { url: string; score: number; detail: boolean }[] = [];
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
  let details = 0;
  for (const page of ranked) {
    if (picked.length >= limit) break;
    if (page.detail && details >= MAX_DETAIL_PAGES) continue;
    if (page.detail) details++;
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
