import { z } from "zod";
import { SCENE_KINDS, STICKER_NAMES, TRANSITION_INTENTS } from "./video";

// The creative brief: everything the Producer needs to make one ad, written by the Creative
// Director and checked by QA Gate 1. Stored on plan_items.brief (and copied to media.creative_spec).

export const FORMATS = ["static", "carousel", "video", "text"] as const;
export type Format = (typeof FORMATS)[number];

// The shared vocabulary of the creative agents and the learning loop (knowledge base §13): the
// Planner, Creative Director, QA and Performance Analyst all use these exact values.

export const HOOK_TYPES = [
  "question",
  "bold_claim",
  "contrarian",
  "number_list",
  "pov",
  "mistake",
  "result_first",
  "before_after",
  "pattern_interrupt",
  "story_open",
  "callout",
  "social_signal",
  "teach",
  "challenge",
  "confession",
] as const;
export type HookType = (typeof HOOK_TYPES)[number];

export const FRAMEWORKS = [
  "spark",
  "myth_killer",
  "countdown",
  "origin_story",
  "shortcut",
  "raw_take",
  "pressure_cooker",
  "conviction",
  "face_off",
  "bridge",
  "cliffhanger",
  "witness",
  "demo_drop",
  "time_machine",
  "educator",
  "aida",
  "pas",
  "bab",
  "hook_story_offer",
] as const;
export type Framework = (typeof FRAMEWORKS)[number];

export const LEVERS = [
  "social_proof",
  "authority",
  "scarcity",
  "reciprocity",
  "commitment",
  "liking",
  "unity",
  "loss_aversion",
  "anchoring",
  "curiosity_gap",
  "identity",
  "mechanism",
  "redefinition",
  "concentration",
  "intensification",
  "risk_reversal",
] as const;
export type Lever = (typeof LEVERS)[number];

/** Levers that only work with a stored fact behind them: real reviews or credentials, a live offer, a real guarantee. */
export const FACT_LEVERS: Lever[] = ["social_proof", "authority", "scarcity", "risk_reversal"];

/** The six permanent desires: one ad taps exactly one */
export const DESIRES = ["health", "attraction", "status", "belonging", "control", "comfort"] as const;
export type Desire = (typeof DESIRES)[number];

/** The five customer awareness levels */
export const AWARENESS_LEVELS = ["unaware", "problem_aware", "solution_aware", "product_aware", "most_aware"] as const;
export type AwarenessLevel = (typeof AWARENESS_LEVELS)[number];

/** What a post is for: reach new people, turn interest into action, or bring back people who know the brand */
export const AD_OBJECTIVES = ["awareness", "converting", "retargeting"] as const;
export type AdObjective = (typeof AD_OBJECTIVES)[number];

export const STYLE_MODIFIERS = ["grit", "polished", "native", "cinematic"] as const;
export type StyleModifier = (typeof STYLE_MODIFIERS)[number];

/** Proven shapes for image ads and carousels */
export const STATIC_FRAMEWORKS = ["offer_card", "golden_review", "editorial_callout", "notes_screenshot", "side_by_side", "listicle_carousel", "myth_vs_fact"] as const;
export type StaticFramework = (typeof STATIC_FRAMEWORKS)[number];

export const CAMERA_MOVES = [
  "static",
  "pan",
  "tilt",
  "whip_pan",
  "dolly_in",
  "dolly_out",
  "slow_zoom",
  "crash_zoom",
  "slider",
  "truck",
  "pedestal",
  "push_past",
  "arc",
  "orbit",
  "follow",
  "reverse_tracking",
  "side_tracking",
  "handheld",
  "top_down",
  "crane",
  "drone",
  "low_to_high",
  "motion_control",
  "time_layer",
] as const;
export type CameraMove = (typeof CAMERA_MOVES)[number];

/** Where code puts the logo on a free image ad; the image model keeps that corner plain */
export const LOGO_CORNERS = ["top-left", "top-right", "bottom-left", "bottom-right"] as const;
export type LogoCorner = (typeof LOGO_CORNERS)[number];

export const CTA_LINKS = ["website", "shop", "booking", "whatsapp", "phone", "lead_magnet"] as const;
export type CtaLink = (typeof CTA_LINKS)[number];

const HOOK_LABELS = {
  question: "Question",
  bold_claim: "Bold claim",
  contrarian: "Contrarian",
  number_list: "Numbered list",
  pov: "POV",
  mistake: "Mistake",
  result_first: "Result first",
  before_after: "Before / after",
  pattern_interrupt: "Pattern interrupt",
  story_open: "Story",
  callout: "Callout",
  social_signal: "Social signal",
  teach: "Teach",
  challenge: "Challenge",
  confession: "Confession",
} satisfies Record<HookType, string>;

const FRAMEWORK_LABELS = {
  spark: "Spark",
  myth_killer: "Myth killer",
  countdown: "Countdown",
  origin_story: "Origin story",
  shortcut: "Shortcut",
  raw_take: "Raw take",
  pressure_cooker: "Pressure cooker",
  conviction: "Conviction",
  face_off: "Face-off",
  bridge: "Bridge",
  cliffhanger: "Cliffhanger",
  witness: "Witness",
  demo_drop: "Demo drop",
  time_machine: "Time machine",
  educator: "Educator",
  aida: "AIDA",
  pas: "Problem, agitate, solve",
  bab: "Before, after, bridge",
  hook_story_offer: "Hook, story, offer",
} satisfies Record<Framework, string>;

const LEVER_LABELS = {
  social_proof: "Social proof",
  authority: "Authority",
  scarcity: "Scarcity",
  reciprocity: "Reciprocity",
  commitment: "Commitment",
  liking: "Liking",
  unity: "Unity",
  loss_aversion: "Loss aversion",
  anchoring: "Anchoring",
  curiosity_gap: "Curiosity gap",
  identity: "Identity",
  mechanism: "Mechanism",
  redefinition: "Redefinition",
  concentration: "Beats the alternatives",
  intensification: "Intensification",
  risk_reversal: "Risk reversal",
} satisfies Record<Lever, string>;

// Values plans made before the knowledge-base vocabulary still carry
const OLD_LABELS: Record<string, string> = { number: "Number", urgency: "Urgency", curiosity: "Curiosity", fear_of_missing_out: "Fear of missing out", value: "Value", simplicity: "Simplicity" };

export const LABELS: { hook: Record<string, string>; framework: Record<string, string>; lever: Record<string, string>; format: Record<Format, string> } = {
  hook: { ...OLD_LABELS, ...HOOK_LABELS },
  framework: FRAMEWORK_LABELS,
  lever: { ...OLD_LABELS, ...LEVER_LABELS },
  format: { static: "Image ad", carousel: "Carousel", video: "Video", text: "Text post" },
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
  /** Scenes in a video; one made from a reference video may follow it up to maxReferenceScenes */
  maxScenes: 12,
  maxReferenceScenes: 20,
  /** The longest clip the video model makes in one go (Seedance 2 mini: 15 s), so the longest scene */
  sceneMaxSeconds: 15,
  /** A whole video, at most */
  videoMaxSeconds: 50,
};

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
export const countWords = words;

/** A statement that needs a stored fact: "proof:<id>", "offer:<id>", "offering:<id>", "chunk:<id>" or "answer:<key>". */
const claim = z.object({ text: z.string().trim().min(1).max(400), source: z.string().trim().min(1) });
export type BriefClaim = z.infer<typeof claim>;

/**
 * A hook (knowledge base §4): `text` is the on-screen line; `visual` what frame one shows and how it
 * moves; `spoken` the first line said (videos with a voice); `score` the director's own 1–5 rating.
 */
const hook = z.object({
  type: z.enum(HOOK_TYPES),
  text: z.string().trim().min(3).max(200),
  visual: z.string().trim().max(300).nullable().default(null),
  spoken: z.string().trim().max(200).nullable().default(null),
  score: z.number().min(1).max(5).nullable().default(null),
});

/** The strategic diagnosis written before any copy (knowledge base §2.12) */
export const diagnosisSchema = z.object({
  desire: z.enum(DESIRES),
  awareness: z.enum(AWARENESS_LEVELS),
  sophistication: z.number().int().min(1).max(5),
  /** The belief the ad starts from, quoted */
  belief: z.string().trim().max(300),
  /** 3–5 agreement steps from that belief to the claim */
  gradualization: z.array(z.string().trim().max(200)).max(5).default([]),
  /** The "after" scene the viewer is put inside */
  intensification: z.string().trim().max(400),
  /** Who the buyer becomes */
  identity: z.string().trim().max(200),
  objection: z.string().trim().max(300).nullable().default(null),
  redefinition: z.string().trim().max(300).nullable().default(null),
  mechanism: z.string().trim().max(300),
  /** The alternative (the old way, doing nothing) the ad beats */
  alternative: z.string().trim().max(200).nullable().default(null),
  /** How it looks native on the platform */
  nativeStyle: z.string().trim().max(200),
});
export type Diagnosis = z.infer<typeof diagnosisSchema>;

const base = {
  /** One clear message the whole ad carries */
  message: z.string().trim().min(5).max(300),
  /** Desire, awareness, sophistication and the persuasion path, decided before writing */
  diagnosis: diagnosisSchema.nullable().default(null),
  objective: z.enum(AD_OBJECTIVES).nullable().default(null),
  styleModifier: z.enum(STYLE_MODIFIERS).nullable().default(null),
  /** A realistic AI-made person appears: the post carries the platform's AI label */
  requiresAiLabel: z.boolean().default(false),
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
  /** The client's content style the Planner gave this slot (image or video style id) */
  style: z.string().nullable().default(null),
};

/** How a video sounds: music only, voice only, or a voice over music. */
export const VIDEO_SOUNDS = ["music", "voice", "voice_music", "speech"] as const;

export const TEMPLATE_IDS = ["spotlight", "split", "frame", "bold", "editorial", "poster", "offer", "quote"] as const;
export type TemplateId = (typeof TEMPLATE_IDS)[number];

/**
 * The choices inside a layout, so two ads in the same style don't look the same: text alignment,
 * headline case, and how the price shows. Where the words go on the photo is decided by code from
 * the finished photo (its calm side and the subject).
 */
export const DESIGN_ALIGNS = ["left", "center"] as const;
export const DESIGN_CASES = ["normal", "upper"] as const;
export const PRICE_STYLES = ["circle", "tag", "line"] as const;
export const designSchema = z.object({
  align: z.enum(DESIGN_ALIGNS).default("left"),
  headlineCase: z.enum(DESIGN_CASES).default("normal"),
  priceStyle: z.enum(PRICE_STYLES).default("circle"),
});
export type Design = z.infer<typeof designSchema>;

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
  design: designSchema.default({}),
  /** The proven image-ad shape it follows (knowledge base §5.5) */
  staticFramework: z.enum(STATIC_FRAMEWORKS).nullable().default(null),
  /** Free image ads: the corner where code adds the logo */
  logoCorner: z.enum(LOGO_CORNERS).nullable().default(null),
});

export const carouselBriefSchema = z.object({
  kind: z.literal("carousel"),
  ...base,
  /** Slide 1 is the hook cover, the last slide is the call to action */
  slides: z.array(z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().max(260).default("") })).min(3).max(10),
  imagePrompt: z.string().trim().min(10).max(1200),
  staticFramework: z.enum(STATIC_FRAMEWORKS).nullable().default(null),
});

/** A scene's picture: one of the client's photos, a moment of the client's own video, or made by AI */
export const sceneSourceSchema = z.discriminatedUnion("kind", [
  /** Made by AI; the real photo it takes its product from, when one is named */
  z.object({ kind: z.literal("ai"), referenceAssetId: z.string().uuid().nullish() }),
  z.object({ kind: z.literal("photo"), assetId: z.string().uuid() }),
  z.object({
    kind: z.literal("clip"),
    assetId: z.string().uuid(),
    /** The moment, in seconds of the source video */
    start: z.number().min(0),
    end: z.number().min(0),
    /** Keep the person's own sound (talking moments) instead of a voice-over */
    keepAudio: z.boolean().default(false),
  }),
]);
export type SceneSource = z.infer<typeof sceneSourceSchema>;

export const videoSceneSchema = z.object({
  /** From the scene library (core/creative/video.ts) */
  kind: z.enum(SCENE_KINDS).default("benefit"),
  /** Spoken words; empty in music-only scenes and in talking moments (the person speaks) */
  voiceover: z.string().trim().max(240).default(""),
  /** Length in seconds when nothing is spoken; voiced scenes follow the speech */
  seconds: z.number().min(0.3).max(15).nullable().default(null),
  /** Big text on screen, at most 7 words */
  overlay: z.string().trim().max(60).default(""),
  /** Up to 3 words from the voice-over or the on-screen line to stand out */
  keywords: z.array(z.string().trim().min(1).max(40)).max(3).default([]),
  /** What the camera sees (made by AI when the source is "ai"; a description otherwise). No text in the picture. */
  visual: z.string().trim().min(10).max(800),
  /** The camera, as the clip prompt's first line: movement and rig, start, speed, framing, end (knowledge base §8.2) */
  motion: z.string().trim().max(400).default("static, locked frame"),
  /** The move by name, for the learning loop and QA */
  cameraMove: z.enum(CAMERA_MOVES).nullable().default(null),
  source: sceneSourceSchema.default({ kind: "ai" }),
  /** "reveal" scenes: the after picture wiped in over the before (an AI one is made from revealVisual) */
  revealSource: sceneSourceSchema.nullable().default(null),
  revealVisual: z.string().trim().max(800).default(""),
  /** An emoji sticker by name (STICKERS), at the first keyword */
  sticker: z.enum(STICKER_NAMES).nullable().default(null),
  /** "stat" scenes: a number from a stored fact that counts up */
  stat: z
    .object({
      value: z.number(),
      decimals: z.number().int().min(0).max(2).default(0),
      prefix: z.string().max(4).default(""),
      suffix: z.string().max(12).default(""),
      label: z.string().trim().min(1).max(60),
      source: z.string(),
    })
    .nullable()
    .default(null),
  /** "review" scenes: the stored review (proof_items id) */
  proofId: z.string().uuid().nullable().default(null),
  /** Show the current price (only when it is a stored fact) */
  showPrice: z.boolean().default(false),
  /** How the cut into the next scene feels */
  transition: z.enum(TRANSITION_INTENTS).default("smooth"),
});
export type VideoScene = z.infer<typeof videoSceneSchema>;

export const videoBriefSchema = z.object({
  kind: z.literal("video"),
  ...base,
  scenes: z.array(videoSceneSchema).min(2).max(20),
  musicMood: z.string().trim().max(60).default("upbeat"),
  sound: z.enum(VIDEO_SOUNDS).default("voice_music"),
  /** The look (presets in worker/remotion/shared/presets.ts), picked by code from the brand */
  preset: z.string().default("minimal"),
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
  // The image prompt holds any words the image model is asked to paint, so they get the same price, never-say and urgency checks
  if (brief.kind === "static") texts.push(brief.headline, brief.subhead ?? "", brief.badge?.text ?? "", brief.imagePrompt);
  if (brief.kind === "carousel") brief.slides.forEach((s) => texts.push(s.title, s.body));
  if (brief.kind === "video") brief.scenes.forEach((s) => texts.push(s.voiceover, s.overlay, s.stat?.label ?? ""));
  return texts.filter(Boolean);
}

/** Seconds a line takes to say at a natural pace. */
export function spokenSeconds(text: string): number {
  return words(text) / LIMITS.wordsPerSecond;
}
