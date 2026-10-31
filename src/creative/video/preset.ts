import type { PresetId } from "@video/presets";
import type { VideoStyle } from "@/core/onboarding/options";

// Which look a video gets, decided by code from the brand (never at random): the tone sliders from
// Basics (0–100: formal, playful, bold, technical), the industry and the video style. The same
// brand always gets the same look for the same style, so its videos feel like one series.

const QUIET_STYLES: readonly VideoStyle[] = ["showcase", "slides", "bts", "ba"];
const EDITORIAL_INDUSTRIES = ["fashion", "beauty", "home", "art", "travel", "food", "events"];
const CORPORATE_INDUSTRIES = ["finance", "professional", "tech", "real_estate", "education"];

export function choosePreset(tone: Partial<Record<"formal" | "playful" | "bold" | "technical", number>>, industry: string | null, style: string | null): PresetId {
  const t = (axis: "formal" | "playful" | "bold" | "technical") => Number(tone[axis] ?? 50);
  const quiet = !!style && QUIET_STYLES.includes(style as VideoStyle);

  if (t("playful") >= 65 && t("formal") < 60) return "playful";
  if (t("formal") >= 60 && (t("technical") >= 55 || CORPORATE_INDUSTRIES.includes(industry ?? ""))) return "corporate";
  if (t("bold") >= 65 && !quiet) return "bold";
  // Music-led styles in visual industries read best as editorial
  if (EDITORIAL_INDUSTRIES.includes(industry ?? "") && t("bold") < 65) return quiet ? "editorial" : t("playful") >= 50 ? "playful" : "editorial";
  if (t("bold") >= 55) return quiet ? "minimal" : "bold";
  return quiet ? "editorial" : "minimal";
}
