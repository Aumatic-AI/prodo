// Colour maths (WCAG 2.x). Colours are "#rrggbb".

export function toHex(r: number, g: number, b: number): string {
  const part = (n: number) =>
    Math.max(0, Math.min(255, Math.round(n)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`;
}

/** "#abc", "#aabbcc", "rgb(1, 2, 3)" or "rgba(1,2,3,.5)" → "#rrggbb", or null. Mostly transparent colours are ignored. */
export function parseColor(value: string): string | null {
  const v = value.trim().toLowerCase();
  const short = v.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`;
  const long = v.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/);
  if (long) return long[2] && parseInt(long[2], 16) < 128 ? null : `#${long[1]}`;
  const rgb = v.match(/^rgba?\(\s*(\d{1,3})[\s,]+(\d{1,3})[\s,]+(\d{1,3})(?:[\s,/]+([\d.]+%?))?\s*\)$/);
  if (rgb) {
    const alpha = rgb[4] ? (rgb[4].endsWith("%") ? parseFloat(rgb[4]) / 100 : parseFloat(rgb[4])) : 1;
    return alpha < 0.5 ? null : toHex(+rgb[1], +rgb[2], +rgb[3]);
  }
  return null;
}

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function luminance(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** 1 (same) to 21 (black on white). Text needs 4.5 or more (WCAG AA). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** 0 for greys, up to 1 for pure colours (HSL saturation). */
export function saturation(hex: string): number {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const light = (max + min) / 2;
  if (max === min) return 0;
  return light > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
}

/** Rough visual distance (0–441). Under ~60 looks like the same colour. */
export function distance(a: string, b: string): number {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return Math.hypot(r1 - r2, g1 - g2, b1 - b2);
}

export const WHITE = "#ffffff";
export const BLACK = "#111111";
export const MIN_TEXT_CONTRAST = 4.5;

export interface TextPair {
  /** Which brand colour is the background */
  name: string;
  bg: string;
  text: string;
  ratio: number;
}

/** For each named background, the most readable text colour, kept only when it passes 4.5:1. */
export function readablePairs(backgrounds: [string, string | null][], textOptions: string[]): TextPair[] {
  return backgrounds
    .filter((entry): entry is [string, string] => !!entry[1])
    .map(([name, bg]) => {
      const best = textOptions.map((text) => ({ text, ratio: contrast(bg, text) })).sort((a, b) => b.ratio - a.ratio)[0];
      return { name, bg, text: best.text, ratio: Math.round(best.ratio * 100) / 100 };
    })
    .filter((p) => p.ratio >= MIN_TEXT_CONTRAST);
}
