// Small shared rules for drawing: where a zone is on screen, readable text over pictures, and the
// brand fonts. Nothing here decides timing or placement; that comes in the Timeline.

import type { CSSProperties } from "react";
import type { Timeline, Zone } from "../shared/timeline.ts";

/** A full-frame box padded to the safe area, with its content pushed into a zone. */
export function zoneBox(zone: Zone, safe: Timeline["safe"]): CSSProperties {
  return {
    position: "absolute",
    inset: 0,
    paddingTop: safe.top,
    paddingBottom: safe.bottom,
    paddingLeft: safe.left,
    paddingRight: safe.right,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: zone === "top" ? "flex-start" : zone === "middle" ? "center" : "flex-end",
  };
}

/** White text with an outline and soft shadow, readable on any picture (strength 0–1 from the preset). */
export function readable(strength: number, width: number): CSSProperties {
  const stroke = Math.round(width * 0.006 * strength);
  return {
    color: "#ffffff",
    WebkitTextStroke: stroke ? `${stroke}px rgba(0,0,0,0.85)` : undefined,
    paintOrder: "stroke fill",
    textShadow: `0 ${Math.round(width * 0.004)}px ${Math.round(width * 0.02)}px rgba(0,0,0,${0.35 + 0.3 * strength})`,
  };
}

export const FALLBACK_FONT = "DejaVu Sans, Inter, Arial, sans-serif";
export const EMOJI_FONT = "Noto Color Emoji, Apple Color Emoji, Segoe UI Emoji, sans-serif";

export function family(name: string): string {
  return `"${name}", ${FALLBACK_FONT}`;
}

/** Relative luminance, to choose the logo version and readable text on a colour. */
export function luminance(hex: string): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return 0;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const v = c / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}

/**
 * The logo for a background: the version made for it, or, on dark pictures without a light
 * version, the normal logo on a light plate so it stays readable. Null when there's no logo.
 */
export function logoFor(theme: Timeline["theme"], bg: string): { src: string; plate: string | null } | null {
  if (!theme.logo) return null;
  if (luminance(bg) > 0.4) return theme.logo.onLight ? { src: theme.logo.onLight, plate: null } : null;
  if (theme.logo.onDark) return { src: theme.logo.onDark, plate: null };
  return theme.logo.onLight ? { src: theme.logo.onLight, plate: theme.light.bg } : null;
}

/**
 * The colour key words light up in over pictures: the brand's accent or main colour when it is
 * bright enough to read over a dark shade, else a warm yellow.
 */
export function highlight(theme: Timeline["theme"]): string {
  return [theme.accent.bg, theme.primary.bg].find((c) => luminance(c) > 0.18) ?? "#FFD43B";
}
