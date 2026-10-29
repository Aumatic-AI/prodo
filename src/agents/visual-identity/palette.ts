import { BLACK, contrast, distance, luminance, MIN_TEXT_CONTRAST, readablePairs, saturation, WHITE, type TextPair } from "@/lib/color";
import type { CssColor } from "./css";

// Picks brand colours from the logo and the site, and the text colour that reads on each.

export interface BrandColors {
  primary: string | null;
  secondary: string | null;
  accent: string | null;
  bg: string;
  text: string;
  /** Every distinct colour found, best first */
  palette: string[];
  /** Background/text pairs that pass WCAG AA (4.5:1). Ads only use these. */
  pairs: TextPair[];
}

const SAME = 60;
const isColourful = (hex: string) => saturation(hex) > 0.25 && luminance(hex) > 0.02 && luminance(hex) < 0.9;

function distinct(colors: string[]): string[] {
  const out: string[] = [];
  for (const c of colors) if (!out.some((o) => distance(o, c) < SAME)) out.push(c);
  return out;
}

/**
 * Brand-named CSS variables come first, then the logo's colours (most used first), then the
 * site's most used colourful values. Background and text come from the site's light and dark
 * colours, falling back to white and near-black.
 */
/** Colours of chat, social and payment widgets that sites embed; never the brand's own */
const WIDGET_COLOURS = new Set([
  "#25d366", "#2db742", "#128c7e", "#075e54", // WhatsApp
  "#1877f2", "#3b5998", "#4267b2", "#0084ff", // Facebook, Messenger
  "#1da1f2", "#e1306c", "#c13584", // X, Instagram
  "#008060", "#5c6ac4", "#5a31f4", // Shopify, Shop Pay
  "#003087", "#009cde", "#ffc439", "#635bff", "#4285f4", // PayPal, Stripe, Google
]);

export function pickColors(logoPalette: string[], css: CssColor[]): BrandColors {
  const brandVars = css.filter((c) => c.brand).map((c) => c.hex);
  const siteColours = css.filter((c) => !c.brand && !WIDGET_COLOURS.has(c.hex.toLowerCase())).map((c) => c.hex);
  const colourful = distinct([...brandVars, ...logoPalette, ...siteColours].filter(isColourful));
  const [primary = null, secondary = null, accent = null] = colourful;

  const lights = css.filter((c) => luminance(c.hex) > 0.85).sort((a, b) => b.count - a.count);
  const darks = css.filter((c) => luminance(c.hex) < 0.08).sort((a, b) => b.count - a.count);
  const bg = lights[0]?.hex ?? WHITE;
  let text = darks[0]?.hex ?? BLACK;
  if (contrast(bg, text) < MIN_TEXT_CONTRAST) text = BLACK;

  const named: [string, string | null][] = [
    ["primary", primary],
    ["secondary", secondary],
    ["accent", accent],
    ["bg", bg],
    ["text", text],
  ];
  const pairs = readablePairs(named, [WHITE, BLACK, text, bg]);

  return {
    primary,
    secondary,
    accent,
    bg,
    text,
    palette: distinct([...colourful, bg, text, ...css.map((c) => c.hex)]).slice(0, 12),
    pairs,
  };
}
