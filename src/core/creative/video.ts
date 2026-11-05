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
  /** What this style of video is, for the Creative Director; how the story unfolds is its call */
  shape: string;
  /** Real footage to prefer, in order: the client's video moments, their photos, then AI */
  prefer: "footage" | "photos" | "any";
  /** A thin progress bar (explainers, how-tos) */
  progressBar: boolean;
}

export const STORYLINES: Record<VideoStyle, Storyline> = {
  showcase: { shape: "The product itself is the star: how it looks, its details and what it is like to have it. Music carries it, with short on-screen lines.", prefer: "footage", progressBar: false },
  faceless: { shape: "A voice tells a short story around the product or service, over pictures of it and of the people it is for. Nobody speaks to camera.", prefer: "any", progressBar: true },
  talking: { shape: "A real person from the client's videos speaks to camera in their own voice, with cutaways of the product or the work.", prefer: "footage", progressBar: false },
  ugc: { shape: "A customer's own words and real experience of the product. It feels real and unpolished.", prefer: "footage", progressBar: false },
  howto: { shape: "How the product or service is used, or how the result is reached, step by step, with a voice guiding.", prefer: "any", progressBar: true },
  bts: { shape: "How the product is made or the work is done, and the finished result. Music and short lines.", prefer: "footage", progressBar: false },
  ba: { shape: "A transformation: how it was before and how it is after.", prefer: "photos", progressBar: false },
  slides: { shape: "A slideshow of still pictures of the product, each with gentle motion and a short line. Music carries it.", prefer: "any", progressBar: false },
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
