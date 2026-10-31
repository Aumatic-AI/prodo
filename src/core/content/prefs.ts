import type { SupabaseClient } from "@supabase/supabase-js";
import { INDUSTRY_NEVER_SAY } from "@/config/industry-rules";
import type { ContentPrefs } from "@/core/onboarding/load";
import type { ContentMix, CtaChoice, Goal, ImageStyle, LogoChoice, MusicMood, PeopleChoice, VideoStyle } from "@/core/onboarding/options";
import { CTA_CHOICES, GOALS, IMAGE_STYLES, MUSIC_MOODS, VIDEO_STYLES } from "@/core/onboarding/options";

// The client's onboarding answers as rules for the weekly agents (Planner, Creative Director,
// Producer). One reader, so every agent understands the answers the same way.

export interface ContentRules {
  /** Ranked: the first one drives most posts */
  goals: Goal[];
  /** null = not answered (Prodo picks a balanced mix) */
  mix: ContentMix | null;
  imageStyles: ImageStyle[];
  videoStyles: VideoStyle[];
  people: PeopleChoice | null;
  /** false only when the client said "Never" */
  showLogo: boolean;
  /** The one next step on every post (shop, WhatsApp, book, call) */
  cta: CtaChoice | null;
  musicMood: MusicMood | null;
  industry: string | null;
  /** Claims the industry may never make in ads */
  industryNeverSay: string[];
}

const only = <T extends string>(values: readonly T[], list: unknown): T[] =>
  Array.isArray(list) ? list.filter((v): v is T => (values as readonly string[]).includes(v)) : [];

const oneOf = <T extends string>(values: readonly T[], v: unknown): T | null => ((values as readonly string[]).includes(v as string) ? (v as T) : null);

/** Rules from a business_profile row. Unanswered questions give open rules, never a block. */
export function contentRules(profile: Record<string, any> | null): ContentRules {
  const prefs: ContentPrefs = profile?.content_prefs ?? {};
  const goals = only(GOALS, prefs.goals);
  const industry = profile?.industry ?? null;
  return {
    goals: goals.length ? goals : only(GOALS, [profile?.primary_goal]),
    mix: prefs.mix ?? null,
    imageStyles: only(IMAGE_STYLES, prefs.image_styles),
    videoStyles: prefs.mix === "images" ? [] : only(VIDEO_STYLES, prefs.video_styles),
    people: prefs.people ?? null,
    showLogo: (prefs.logo as LogoChoice | undefined) !== "never",
    cta: oneOf(CTA_CHOICES, profile?.primary_cta),
    musicMood: oneOf(MUSIC_MOODS, profile?.music_mood),
    industry,
    industryNeverSay: [...(INDUSTRY_NEVER_SAY[industry as keyof typeof INDUSTRY_NEVER_SAY] ?? [])],
  };
}

export async function loadContentRules(db: SupabaseClient): Promise<ContentRules> {
  const { data, error } = await db.from("business_profile").select("content_prefs, primary_goal, primary_cta, music_mood, industry").single();
  if (error) throw error;
  return contentRules(data);
}

/** The cta_links key each next-step choice uses. */
export const CTA_LINK_KEY: Record<CtaChoice, "shop" | "whatsapp" | "booking" | "phone"> = {
  shop: "shop",
  whatsapp: "whatsapp",
  book: "booking",
  call: "phone",
};

const CTA_WORDS: Record<CtaChoice, string> = {
  shop: "buy in the online shop",
  whatsapp: "message on WhatsApp",
  book: "book an appointment",
  call: "call the business",
};

export function ctaWords(cta: CtaChoice): string {
  return CTA_WORDS[cta];
}

const PEOPLE_WORDS: Record<PeopleChoice, string> = {
  real: "Real people only: show the owner, team or customers using the REAL PHOTOS of people ([G] labels of kind person or team). Never invent staff or customers; when no real photo of a person fits, show the product, hands or the place instead.",
  ai: "People are welcome: AI-made models may appear (using, wearing or holding the product).",
  none: "NO PEOPLE: show only products, places and details. No person, face or body in any picture or scene (hands only when unavoidable).",
};

export function peopleRule(people: PeopleChoice | null): string | null {
  return people ? PEOPLE_WORDS[people] : null;
}

/** Image and clip prompt line for the people choice. */
export function peoplePromptLine(people: PeopleChoice | null): string {
  return people === "none" ? "No people: no person, face or body anywhere in the picture." : "";
}
