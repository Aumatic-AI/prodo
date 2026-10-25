import { LIMITS } from "@/config/limits";
import { request } from "@/providers/http";
import { parseColor } from "@/lib/color";

// Colours and fonts from the homepage's HTML and stylesheets. Plain text parsing, no AI.

const MAX_STYLESHEETS = 5;
const MAX_CSS_BYTES = 600_000;

const GENERIC_FONTS = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "cursive",
  "fantasy",
  "system-ui",
  "ui-sans-serif",
  "ui-serif",
  "ui-monospace",
  "-apple-system",
  "blinkmacsystemfont",
  "segoe ui",
  "roboto",
  "helvetica",
  "helvetica neue",
  "arial",
  "inherit",
  "initial",
  "apple color emoji",
  "segoe ui emoji",
  "segoe ui symbol",
  "noto color emoji",
  "var",
]);

export interface CssColor {
  hex: string;
  count: number;
  /** Named like a brand colour in a CSS variable (--primary, --brand-color…) */
  brand: boolean;
}

export interface SiteDesign {
  colors: CssColor[];
  fonts: { heading: string | null; body: string | null; all: string[] };
}

/** Inline <style> blocks plus the text of linked stylesheets (same site or font CDNs). */
export async function collectCss(html: string, pageUrl: string): Promise<{ css: string; fontLinks: string[] }> {
  const inline = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]);
  const styleAttrs = [...html.matchAll(/\sstyle="([^"]*)"/gi)].map((m) => `x{${m[1]}}`);
  const links = [...html.matchAll(/<link[^>]+>/gi)]
    .map((m) => m[0])
    .filter((tag) => /rel=["']?stylesheet/i.test(tag))
    .map((tag) => tag.match(/href=["']([^"']+)["']/i)?.[1])
    .filter((href): href is string => !!href)
    .map((href) => {
      try {
        return new URL(href.replace(/&amp;/g, "&"), pageUrl).toString();
      } catch {
        return null;
      }
    })
    .filter((href): href is string => !!href);

  const fontLinks = links.filter((href) => /fonts\.(googleapis|bunny)\.net|use\.typekit\.net/i.test(href));
  const sheets = links.filter((href) => !fontLinks.includes(href)).slice(0, MAX_STYLESHEETS);

  const fetched = await Promise.all(
    sheets.map(async (href) => {
      try {
        const res = await request("Website", href, {}, LIMITS.fetchTimeoutMs / 2);
        if (!res.ok) return "";
        return (await res.text()).slice(0, MAX_CSS_BYTES);
      } catch {
        return "";
      }
    })
  );
  return { css: [...inline, ...styleAttrs, ...fetched].join("\n"), fontLinks };
}

/** Fallback, emoji and symbol fonts that frameworks add after the real one. */
const HELPER_FONT = /fallback|emoji|symbol|^-|^var\b/i;
const isMono = (family: string) => /mono|consol|courier|menlo/i.test(family);

function firstFamily(value: string): string | null {
  for (const raw of value.split(",")) {
    const name = raw
      .replace(/!important/i, "")
      .replace(/["'()]/g, "")
      .trim();
    if (name && !GENERIC_FONTS.has(name.toLowerCase()) && !HELPER_FONT.test(name)) return name;
  }
  return null;
}

/** Families named in Google Fonts / Bunny links: "family=Playfair+Display:wght@700" → "Playfair Display". */
function linkedFamilies(fontLinks: string[]): string[] {
  return fontLinks.flatMap((href) =>
    [...href.matchAll(/family=([^&:]+)/g)].flatMap((m) =>
      decodeURIComponent(m[1].replace(/\+/g, " "))
        .split("|")
        .map((f) => f.split(":")[0].trim())
    )
  );
}

export function readDesign(css: string, fontLinks: string[]): SiteDesign {
  // Colours: every value, counted; brand-named variables flagged
  const counts = new Map<string, CssColor>();
  const add = (hex: string | null, brand = false) => {
    if (!hex) return;
    const entry = counts.get(hex) ?? { hex, count: 0, brand: false };
    entry.count++;
    entry.brand ||= brand;
    counts.set(hex, entry);
  };
  for (const m of css.matchAll(/--([\w-]+)\s*:\s*(#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\))/g)) {
    add(parseColor(m[2]), /primary|brand|accent|secondary|main|theme/i.test(m[1]));
  }
  for (const m of css.matchAll(/(?:^|[;{\s])(?:color|background(?:-color)?|border(?:-color)?|fill|stroke)\s*:\s*([^;}]+)/gi)) {
    for (const value of m[1].match(/#[0-9a-fA-F]{3,8}\b|rgba?\([^)]*\)/g) ?? []) add(parseColor(value));
  }

  // Fonts: by selector when possible, otherwise by how often they appear. Sites built with
  // Next.js or Tailwind name fonts through CSS variables (var(--font-sans)), so those are resolved first.
  const vars = new Map<string, string>();
  for (const m of css.matchAll(/--([\w-]+)\s*:\s*([^;}]+)/g)) if (!vars.has(m[1])) vars.set(m[1], m[2].trim());
  const resolve = (value: string) => {
    let out = value;
    for (let i = 0; i < 4 && out.includes("var("); i++) {
      out = out.replace(/var\(\s*--([\w-]+)\s*(?:,([^()]*))?\)/g, (_, name: string, fallback?: string) => vars.get(name) ?? fallback ?? "");
    }
    return out;
  };

  let heading: string | null = null;
  let body: string | null = null;
  const fontCounts = new Map<string, number>();
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*font-family\s*:\s*([^;}]+)[^{}]*)\}/gi)) {
    const selector = m[1].trim().toLowerCase();
    if (selector.endsWith("@font-face")) continue;
    const family = firstFamily(resolve(m[3]));
    if (!family) continue;
    fontCounts.set(family, (fontCounts.get(family) ?? 0) + 1);
    if (!heading && /(^|[\s,])h[1-3]\b|heading|title|display/.test(selector)) heading = family;
    if (!body && !isMono(family) && /(^|[\s,])(body|html|:root|:host)\b|\.font-sans\b/.test(selector)) body = family;
  }
  const linked = linkedFamilies(fontLinks);
  const byUse = [...fontCounts.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f);
  const all = [...new Set([...linked, ...byUse])];
  // Code fonts are never the body font
  body ??= byUse.find((f) => !isMono(f)) ?? linked.find((f) => !isMono(f)) ?? null;
  heading ??= all.find((f) => f !== body) ?? body;

  return {
    colors: [...counts.values()].sort((a, b) => Number(b.brand) - Number(a.brand) || b.count - a.count).slice(0, 40),
    fonts: { heading, body, all: all.slice(0, 8) },
  };
}
