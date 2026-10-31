import type { SceneKind } from "@video/timeline";
import type { TransitionIntent } from "@video/presets";
import type { VideoStyle } from "@/core/onboarding/options";

// Video storylines and scenes. A storyline is the high-level shape of one video style (how it opens,
// what the middle can hold, how it closes); the Creative Director fills it per post with scenes
// from the scene library below, and our code checks the result. Nothing per scene is fixed here.

export const SCENE_KINDS = [
  "hook",
  "problem",
  "product",
  "detail",
  "benefit",
  "step",
  "stat",
  "review",
  "offer",
  "before",
  "after",
  "reveal",
  "process",
  "talking",
  "result",
  "cta",
] as const satisfies readonly SceneKind[];

/** What each scene is for, written for the Creative Director. */
export const SCENE_LIBRARY: Record<SceneKind, string> = {
  hook: "The first 1–3 seconds: a striking picture and the hook line, so people stop scrolling.",
  problem: "The pain or desire the viewer feels, shown in a real moment.",
  product: "The product or result as the hero, close and clear; the price can appear here when the price is a stored fact.",
  detail: "A close-up of one detail: texture, finish, a feature in use.",
  benefit: "What the viewer gets, shown, with one short line.",
  step: "One numbered step of a how-to; the number appears on screen.",
  stat: "A number from a stored fact counts up on screen (needs a fact label).",
  review: "A real customer review on a card over a soft picture (needs a review label).",
  offer: "The live offer on screen (needs the offer label [F1]).",
  before: "The situation before: the problem, the raw state.",
  after: "The finished result after the product or service.",
  reveal: "Before turning into after in one wipe: use \"before\" as the picture and \"after\" as the reveal.",
  process: "The making or the work in progress, behind the scenes.",
  talking: "A real person from the client's videos speaking to camera, with their own sound (needs a talking moment [V…]).",
  result: "The outcome or the happy customer, the payoff.",
  cta: "The closing card: the call to action, the logo or name and one line. Always last.",
};

/** Scene kinds that carry a card over the picture, so their picture can be any calm photo */
export const CARD_SCENES: readonly SceneKind[] = ["stat", "review", "offer", "cta"];

export interface Storyline {
  /** What the video is, for the Creative Director */
  shape: string;
  /** Kinds allowed between the hook and the closing card */
  middle: SceneKind[];
  /** Scene count including hook and cta */
  minScenes: number;
  maxScenes: number;
  /** Real footage to prefer, in order: the client's video moments, their photos, then AI */
  prefer: "footage" | "photos" | "any";
  /** A thin progress bar (explainers, how-tos) */
  progressBar: boolean;
}

export const STORYLINES: Record<VideoStyle, Storyline> = {
  showcase: {
    shape: "Hook on the most striking detail → 2–4 close-ups and details of the product or finished work → optionally the product with its price or a review → closing card. Music carries it; short on-screen lines only.",
    middle: ["product", "detail", "benefit", "review", "offer", "result"],
    minScenes: 4,
    maxScenes: 7,
    prefer: "footage",
    progressBar: false,
  },
  faceless: {
    shape: "Hook → the problem or desire → the product or service as the answer → 1–2 benefits shown → proof (a stat or review, only with a fact) → closing card. A voice tells it like a short story.",
    middle: ["problem", "product", "detail", "benefit", "stat", "review", "offer", "result"],
    minScenes: 4,
    maxScenes: 7,
    prefer: "any",
    progressBar: true,
  },
  talking: {
    shape: "A real person speaks to camera: hook in their words → their main point, with b-roll cutaways of the product or work → proof → closing card. Uses the client's talking moments with their own sound.",
    middle: ["talking", "product", "detail", "benefit", "review", "stat", "result"],
    minScenes: 3,
    maxScenes: 6,
    prefer: "footage",
    progressBar: false,
  },
  ugc: {
    shape: "A customer's own words (a talking moment) → the product in use → a review card → closing card. Feels real and unpolished.",
    middle: ["talking", "product", "detail", "review", "result"],
    minScenes: 3,
    maxScenes: 6,
    prefer: "footage",
    progressBar: false,
  },
  howto: {
    shape: "Hook (the result or the promise) → 2–5 numbered steps, one per scene → the result → closing card. A voice guides each step.",
    middle: ["step", "result", "detail"],
    minScenes: 4,
    maxScenes: 7,
    prefer: "any",
    progressBar: true,
  },
  bts: {
    shape: "Hook (an intriguing moment of the work) → 3–4 moments of the making or the work in progress → the finished product or result → closing card. Music, short lines.",
    middle: ["process", "detail", "product", "result"],
    minScenes: 4,
    maxScenes: 7,
    prefer: "footage",
    progressBar: false,
  },
  ba: {
    shape: "Hook (the after, or the promise) → before → a reveal wipe from before to after → a close look at the after → closing card. Music carries it.",
    middle: ["before", "reveal", "after", "detail", "review", "result"],
    minScenes: 4,
    maxScenes: 6,
    prefer: "photos",
    progressBar: false,
  },
  slides: {
    shape: "Hook photo with the title → 3–6 of the brand's own photos, each with gentle motion and a short line → closing card. Music carries it. Real photos only.",
    middle: ["product", "detail", "benefit", "result", "review", "offer"],
    minScenes: 4,
    maxScenes: 8,
    prefer: "photos",
    progressBar: false,
  },
};

export const TRANSITION_INTENTS = ["cut", "smooth", "energetic", "reveal"] as const satisfies readonly TransitionIntent[];

/**
 * Emoji the Creative Director may use as stickers, by name (one per scene at most, only when it adds
 * meaning). Named so the model can't invent odd ones; the renderer draws them animated.
 */
export const STICKERS = {
  fire: "🔥",
  sparkles: "✨",
  star: "⭐",
  heart: "❤️",
  check: "✅",
  cross: "❌",
  point_down: "👇",
  eyes: "👀",
  rocket: "🚀",
  money: "💰",
  gift: "🎁",
  clock: "⏰",
  bulb: "💡",
  thumbs_up: "👍",
  party: "🎉",
  hundred: "💯",
  muscle: "💪",
  leaf: "🌿",
} as const;
export type StickerName = keyof typeof STICKERS;
export const STICKER_NAMES = Object.keys(STICKERS) as [StickerName, ...StickerName[]];
