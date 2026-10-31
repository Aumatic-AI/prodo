/* eslint-disable @next/next/no-img-element, jsx-a11y/alt-text -- Satori's JSX subset, not real DOM */
import type { CSSProperties } from "react";
import { luminance } from "@/lib/color";
import type { ColorPair, CreativeTheme } from "../theme";

// Small pieces every layout shares. Satori needs display:flex on any element with children.

export const flex = (style: CSSProperties = {}): CSSProperties => ({ display: "flex", ...style });

/** The right logo version for a background colour; null when the brand has none that fits. */
export function logoFor(theme: CreativeTheme, bg: string): string | null {
  return luminance(bg) > 0.4 ? theme.logo.onLight : (theme.logo.onDark ?? null);
}

export function LogoImg({ src, height, maxWidth }: { src: string | null; height: number; maxWidth: number }) {
  if (!src) return null;
  return <img src={src} height={height} width={maxWidth} style={{ objectFit: "contain", height, width: maxWidth }} />;
}

/**
 * Logo, or the business name in the heading font when there's no logo for this background. When
 * the client chose no logo, nothing shows, except the name on closing frames (`closing`), so
 * viewers still know who the call to action is from.
 */
export function Brand({ theme, bg, height, maxWidth, color, closing = false }: { theme: CreativeTheme; bg: string; height: number; maxWidth: number; color: string; closing?: boolean }) {
  if (!theme.showLogo && !closing) return null;
  const src = logoFor(theme, bg);
  if (src) return <LogoImg src={src} height={height} maxWidth={maxWidth} />;
  return (
    <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: height * 0.62, color, letterSpacing: -0.5 })}>{theme.businessName}</div>
  );
}

export function CtaPill({ label, pair, size, font }: { label: string; pair: ColorPair; size: number; font: string }) {
  return (
    <div
      style={flex({
        alignItems: "center",
        gap: size * 0.45,
        background: pair.bg,
        color: pair.text,
        fontFamily: font,
        fontWeight: 700,
        fontSize: size,
        padding: `${size * 0.62}px ${size * 1.15}px`,
        borderRadius: 999,
        boxShadow: "0 10px 30px rgba(0,0,0,0.18)",
      })}
    >
      {label}
      <span style={{ fontSize: size * 1.05 }}>→</span>
    </div>
  );
}

/** Round price or offer sticker. */
export function Badge({ text, pair, size, font }: { text: string; pair: ColorPair; size: number; font: string }) {
  const fontSize = text.length > 9 ? size * 0.17 : text.length > 5 ? size * 0.21 : size * 0.26;
  return (
    <div
      style={flex({
        width: size,
        height: size,
        borderRadius: size,
        background: pair.bg,
        color: pair.text,
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        fontFamily: font,
        fontWeight: 800,
        fontSize,
        lineHeight: 1.05,
        padding: size * 0.12,
        transform: "rotate(-8deg)",
        boxShadow: "0 12px 34px rgba(0,0,0,0.22)",
      })}
    >
      {text}
    </div>
  );
}

export function Photo({ src, width, height, radius = 0, style = {} }: { src: string; width: number; height: number; radius?: number; style?: CSSProperties }) {
  return <img src={src} width={width} height={height} style={{ width, height, objectFit: "cover", borderRadius: radius, ...style }} />;
}
