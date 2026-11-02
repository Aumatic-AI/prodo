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

export function LogoImg({ src, height, maxWidth, align = "left" }: { src: string | null; height: number; maxWidth: number; align?: "left" | "center" | "right" }) {
  if (!src) return null;
  const objectPosition = align === "center" ? "center" : align === "right" ? "right" : "left";
  return <img src={src} height={height} width={maxWidth} style={{ objectFit: "contain", objectPosition, height, width: maxWidth }} />;
}

/**
 * Logo in the version that reads on `bg`. On a dark background with only a dark logo, the logo sits
 * on a small light plate rather than disappearing; the business name in the heading font shows only
 * when there's no logo at all. When the client chose no logo, nothing shows, except the name on
 * closing frames (`closing`), so viewers still know who the call to action is from.
 */
export function Brand({
  theme,
  bg,
  height,
  maxWidth,
  color,
  closing = false,
  align = "left",
}: {
  theme: CreativeTheme;
  bg: string;
  height: number;
  maxWidth: number;
  color: string;
  closing?: boolean;
  align?: "left" | "center" | "right";
}) {
  if (!theme.showLogo && !closing) return null;
  const src = logoFor(theme, bg);
  if (src) return <LogoImg src={src} height={height} maxWidth={maxWidth} align={align} />;
  if (theme.logo.onLight) {
    const pad = height * 0.22;
    return (
      <div style={flex({ background: "#ffffff", borderRadius: height * 0.22, padding: `${pad}px ${pad * 1.4}px`, boxShadow: "0 6px 20px rgba(0,0,0,0.18)" })}>
        <LogoImg src={theme.logo.onLight} height={height - pad * 2} maxWidth={maxWidth - pad * 2.8} align="center" />
      </div>
    );
  }
  return <div style={flex({ fontFamily: theme.fonts.heading, fontWeight: 800, fontSize: height * 0.62, color, letterSpacing: -0.5 })}>{theme.businessName}</div>;
}

/**
 * The call to action as words, not a button: nothing in a social image can be clicked, so it says
 * what to do and where ("Shop the kimono · royal-gypsy.com"). The caption carries the real link.
 */
export function CtaLine({ cta, link, color, font, size, align = "left" }: { cta: string; link: string | null; color: string; font: string; size: number; align?: "left" | "center" }) {
  return (
    <div style={flex({ flexWrap: "wrap", alignItems: "baseline", justifyContent: align === "center" ? "center" : "flex-start", gap: size * 0.45, color, fontFamily: font, fontSize: size })}>
      <div style={flex({ fontWeight: 600, letterSpacing: 0.2 })}>{cta}</div>
      {link && <div style={flex({ opacity: 0.6 })}>·</div>}
      {link && <div style={flex({ fontWeight: 400, opacity: 0.85 })}>{link}</div>}
    </div>
  );
}

/** A button shape. Image ads and carousels use CtaLine instead (nothing in an image is clickable); only the video end card keeps this. */
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

/** A price tag: a small solid label, slightly tilted. */
export function Tag({ text, pair, size, font }: { text: string; pair: ColorPair; size: number; font: string }) {
  return (
    <div
      style={flex({
        background: pair.bg,
        color: pair.text,
        fontFamily: font,
        fontWeight: 800,
        fontSize: size,
        lineHeight: 1,
        padding: `${size * 0.42}px ${size * 0.7}px`,
        borderRadius: size * 0.18,
        transform: "rotate(-3deg)",
        boxShadow: "0 10px 26px rgba(0,0,0,0.2)",
      })}
    >
      {text}
    </div>
  );
}

/** A price set as a quiet line in the text, with a short rule before it (luxury catalogue feel). */
export function PriceLine({ text, color, font, size, align = "left" }: { text: string; color: string; font: string; size: number; align?: "left" | "center" }) {
  return (
    <div style={flex({ alignItems: "center", justifyContent: align === "center" ? "center" : "flex-start", gap: size * 0.6, color, fontFamily: font, fontSize: size, fontWeight: 700 })}>
      <div style={flex({ width: size * 1.6, height: Math.max(2, size * 0.06), background: color, opacity: 0.7 })} />
      <div style={flex({})}>{text}</div>
    </div>
  );
}

/** A floating price in the chosen style (the "line" style sits in the text instead, so it returns null). */
export function FloatingPrice({ text, style, pair, size, font }: { text: string; style: "circle" | "tag" | "line"; pair: ColorPair; size: number; font: string }) {
  if (style === "line") return null;
  return style === "tag" ? <Tag text={text} pair={pair} size={size * 0.24} font={font} /> : <Badge text={text} pair={pair} size={size} font={font} />;
}

/** A photo cropped to its box around `focus` (the subject's centre, as fractions), so the subject stays in view at every size. */
export function Photo({
  src,
  width,
  height,
  radius = 0,
  focus,
  style = {},
}: {
  src: string;
  width: number;
  height: number;
  radius?: number;
  focus?: { x: number; y: number };
  style?: CSSProperties;
}) {
  const objectPosition = focus ? `${Math.round(focus.x * 100)}% ${Math.round(focus.y * 100)}%` : "center";
  return <img src={src} width={width} height={height} style={{ width, height, objectFit: "cover", objectPosition, borderRadius: radius, ...style }} />;
}
