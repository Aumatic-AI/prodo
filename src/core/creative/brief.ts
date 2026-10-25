import { z } from "zod";

// The creative brief: everything the Producer needs to make one ad, written by the Creative
// Director and checked by QA Gate 1. Stored on plan_items.brief (and copied to media.creative_spec).

export const FORMATS = ["static", "carousel", "video", "text"] as const;
export type Format = (typeof FORMATS)[number];

export const HOOK_TYPES = ["question", "bold_claim", "contrarian", "number", "pov", "mistake", "pattern_interrupt", "before_after"] as const;
export type HookType = (typeof HOOK_TYPES)[number];

export const FRAMEWORKS = ["aida", "pas", "bab", "hook_story_offer"] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const LEVERS = ["social_proof", "scarcity", "urgency", "authority", "reciprocity", "curiosity", "fear_of_missing_out", "value", "simplicity", "identity"] as const;
export type Lever = (typeof LEVERS)[number];

/** Levers that only work with a stored fact behind them (a live offer, a review, a credential). */
export const FACT_LEVERS: Lever[] = ["social_proof", "scarcity", "urgency", "authority"];

export const CTA_LINKS = ["website", "shop", "booking", "whatsapp", "lead_magnet"] as const;
export type CtaLink = (typeof CTA_LINKS)[number];

export const LABELS = {
  hook: {
    question: "Question",
    bold_claim: "Bold claim",
    contrarian: "Contrarian",
    number: "Number",
    pov: "POV",
    mistake: "Mistake",
    pattern_interrupt: "Pattern interrupt",
    before_after: "Before / after",
  } satisfies Record<HookType, string>,
  framework: { aida: "AIDA", pas: "Problem, agitate, solve", bab: "Before, after, bridge", hook_story_offer: "Hook, story, offer" } satisfies Record<Framework, string>,
  lever: {
    social_proof: "Social proof",
    scarcity: "Scarcity",
    urgency: "Urgency",
    authority: "Authority",
    reciprocity: "Reciprocity",
    curiosity: "Curiosity",
    fear_of_missing_out: "Fear of missing out",
    value: "Value",
    simplicity: "Simplicity",
    identity: "Identity",
  } satisfies Record<Lever, string>,
  format: { static: "Image ad", carousel: "Carousel", video: "Video", text: "Text post" } satisfies Record<Format, string>,
};

/** On-screen text limits (enforced in code). About 2.5 spoken words per second. */
export const LIMITS = {
  headlineWords: 8,
  subheadWords: 18,
  overlayWords: 7,
  ctaWords: 4,
  slideTitleWords: 8,
  slideBodyWords: 30,
  wordsPerSecond: 2.5,
  minSlides: 5,
  maxSlides: 8,
  minScenes: 3,
  maxScenes: 6,
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const countWords = words;

/** A statement that needs a stored fact: "proof:<id>", "offer:<id>", "offering:<id>", "chunk:<id>" or "answer:<key>". */
const claim = z.object({ text: z.string().trim().min(1).max(400), source: z.string().trim().min(1) });
export type BriefClaim = z.infer<typeof claim>;

const hook = z.object({ type: z.enum(HOOK_TYPES), text: z.string().trim().min(3).max(200) });

const base = {
  /** One clear message the whole ad carries */
  message: z.string().trim().min(5).max(300),
  hook,
  /** The other hook ideas, kept for the hook library and redos */
  hookOptions: z.array(hook).max(10).default([]),
  framework: z.enum(FRAMEWORKS),
  levers: z.array(z.object({ lever: z.enum(LEVERS), source: z.string().nullable().default(null) })).max(4),
  cta: z.object({ label: z.string().trim().min(2).max(40), link: z.enum(CTA_LINKS) }),
  claims: z.array(claim).max(8).default([]),
  /** Platform → caption (hashtags included) */
  captions: z.record(z.string(), z.string().trim().min(1).max(5000)),
  /** Real photo to use as the reference image (brand_assets id) */
  referenceAssetId: z.string().uuid().nullable().default(null),
};

export const TEMPLATE_IDS = ["spotlight", "split", "frame", "bold"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

export const staticBriefSchema = z.object({
  kind: z.literal("static"),
  ...base,
  headline: z.string().trim().min(2).max(80),
  subhead: z.string().trim().max(140).nullable().default(null),
  /** Price or offer text, only from a stored offer or offering */
  badge: z.object({ text: z.string().trim().min(1).max(24), source: z.string() }).nullable().default(null),
  /** What the background photo shows. No text in the image: our code draws all text. */
  imagePrompt: z.string().trim().min(10).max(1200),
  layout: z.enum(TEMPLATE_IDS),
});

export const carouselBriefSchema = z.object({
  kind: z.literal("carousel"),
  ...base,
  /** Slide 1 is the hook cover, the last slide is the call to action */
  slides: z.array(z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().max(260).default("") })).min(3).max(10),
  imagePrompt: z.string().trim().min(10).max(1200),
});

export const videoBriefSchema = z.object({
  kind: z.literal("video"),
  ...base,
  scenes: z
    .array(
      z.object({
        voiceover: z.string().trim().min(2).max(240),
        /** Big text on screen, at most 7 words */
        overlay: z.string().trim().max(60).default(""),
        /** What the camera sees. No text in the picture. */
        visual: z.string().trim().min(10).max(800),
        /** Camera motion only, e.g. "slow push in" */
        motion: z.string().trim().max(200).default("slow push in"),
      })
    )
    .min(2)
    .max(8),
  musicMood: z.string().trim().max(60).default("upbeat"),
});

export const textBriefSchema = z.object({
  kind: z.literal("text"),
  ...base,
});

export const briefSchema = z.discriminatedUnion("kind", [staticBriefSchema, carouselBriefSchema, videoBriefSchema, textBriefSchema]);
export type Brief = z.infer<typeof briefSchema>;
export type StaticBrief = z.infer<typeof staticBriefSchema>;
export type CarouselBrief = z.infer<typeof carouselBriefSchema>;
export type VideoBrief = z.infer<typeof videoBriefSchema>;

/** The format a brief needs to be produced in. */
export function briefFormat(brief: Brief): Format {
  return brief.kind;
}

/** Every piece of text a viewer reads or hears, for word checks. */
export function briefTexts(brief: Brief): string[] {
  const texts = [brief.hook.text, brief.message, brief.cta.label, ...Object.values(brief.captions)];
  if (brief.kind === "static") texts.push(brief.headline, brief.subhead ?? "", brief.badge?.text ?? "");
  if (brief.kind === "carousel") brief.slides.forEach((s) => texts.push(s.title, s.body));
  if (brief.kind === "video") brief.scenes.forEach((s) => texts.push(s.voiceover, s.overlay));
  return texts.filter(Boolean);
}

/** Seconds a line takes to say at a natural pace. */
export function spokenSeconds(text: string): number {
  return words(text) / LIMITS.wordsPerSecond;
}
