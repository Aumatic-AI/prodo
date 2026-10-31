import type { Box, Theme, Zone } from "@video/timeline";
import type { CreativeTheme } from "@/creative/theme";
import { CANVAS, type Canvas, type CanvasRatio } from "@/creative/sizes";
import type { FootageMoment } from "@/prompts/agents/footage";
import { publicUrl } from "@/providers/storage/paths";

// Small pure helpers the video producer uses to fill the timeline: the brand theme for the renderer,
// placement from the footage log, the price and the link as people read them, and video safe areas.

/**
 * Space kept clear of text in videos. Reels, TikTok and Shorts cover the bottom third (caption,
 * buttons) and a strip at the top and right; Meta asks ads to keep 14% top, 35% bottom, 6% sides.
 */
const VIDEO_SAFE: Partial<Record<CanvasRatio, Canvas["safe"]>> = {
  "9:16": { top: 260, right: 110, bottom: 620, left: 90 },
  "4:5": { top: 90, right: 80, bottom: 130, left: 80 },
};

export function videoCanvas(ratio: CanvasRatio): Canvas {
  const canvas = CANVAS[ratio];
  return { ...canvas, safe: VIDEO_SAFE[ratio] ?? canvas.safe };
}

/** Our CreativeTheme (Satori ads) → the renderer's theme, with font files as links. */
export function timelineTheme(t: CreativeTheme): Theme {
  return {
    primary: t.primary,
    accent: t.accent,
    light: t.light,
    dark: t.dark,
    heading: t.fonts.heading,
    body: t.fonts.body,
    fonts: t.fontFiles.map((f) => ({ family: f.family, weight: f.weight, url: publicUrl(f.key) })),
    logo: t.showLogo ? t.logo : null,
    businessName: t.businessName,
  };
}

/** The footage log says where the subject is in words; the renderer needs a box. */
export function momentLayout(m: Pick<FootageMoment, "subject" | "textArea" | "people" | "shot">): { subject: Box; zone: Zone | null; light: boolean | null } {
  const w = m.shot === "close-up" || m.shot === "detail" ? 0.7 : m.shot === "wide" ? 0.5 : 0.55;
  const h = m.people === "person" || m.people === "group" ? 0.55 : w * 0.8;
  const x = m.subject.x === "left" ? 0.05 : m.subject.x === "right" ? 0.95 - w : 0.5 - w / 2;
  const y = m.subject.y === "top" ? 0.12 : m.subject.y === "bottom" ? 0.88 - h : 0.5 - h / 2;
  return { subject: { x, y, w, h }, zone: m.textArea === "none" ? null : m.textArea, light: null };
}

/** "€49", "From €49" or "€49/month" in the business's currency. */
export function priceText(price: number, currency: string | null, model: string | null): string {
  let amount: string;
  try {
    amount = new Intl.NumberFormat("en", { style: "currency", currency: currency || "USD", maximumFractionDigits: price % 1 ? 2 : 0 }).format(price);
  } catch {
    amount = `${price}${currency ? ` ${currency}` : ""}`;
  }
  if (model === "from") return `From ${amount}`;
  if (model === "subscription") return `${amount}/mo`;
  if (model === "hourly") return `${amount}/hr`;
  return amount;
}

/** The call-to-action link as people read it: a site without "https://", or a phone number. */
export function linkText(link: string | null | undefined): string {
  if (!link) return "";
  if (/^\+?[\d\s()-]{7,}$/.test(link)) return link.trim();
  return link.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "").slice(0, 40);
}
