import type { ContentMix, ImageStyle, PeopleChoice, VideoStyle } from "@/core/onboarding/options";
import { IMAGE_STYLES, VIDEO_STYLE_SOUND, VIDEO_STYLES } from "@/core/onboarding/options";

// What each content style from onboarding means for the agents: which formats can carry it, how a
// video sounds, whether it needs people, and a plain description the Creative Director works from.

export type StyleFormat = "static" | "carousel" | "video";

/** Formats an image style can be made in. */
export const IMAGE_STYLE_FORMATS: Record<ImageStyle, StyleFormat[]> = {
  product: ["static", "carousel"],
  life: ["static", "carousel"],
  people: ["static", "carousel"],
  promo: ["static"],
  tips: ["carousel"],
  review: ["static", "carousel"],
  ba: ["static", "carousel"],
  bts: ["static", "carousel"],
};

/** Styles that put people on screen: left out when the client wants no people. */
export const PEOPLE_STYLES: readonly (ImageStyle | VideoStyle)[] = ["people", "talking", "ugc"];

/**
 * Talking to camera and customer videos need real footage of someone speaking (a talking moment in
 * the client's own videos, see agents/footage). Without it they're made as a voice-over video.
 */
const NEEDS_TALKING_FOOTAGE: readonly VideoStyle[] = ["talking", "ugc"];

export function videoStyleWeMake(style: VideoStyle, talkingFootage = false): VideoStyle {
  return NEEDS_TALKING_FOOTAGE.includes(style) && !talkingFootage ? "faceless" : style;
}

/**
 * How a video sounds: music only, a made voice-over (with or without music), or real speech (the
 * client's talking moments with their own sound, soft music under). Natural sound needs real
 * footage of the work, so it gets music.
 */
export type VideoSound = "music" | "voice" | "voice_music" | "speech";

export function videoSound(style: VideoStyle, talkingFootage = false): VideoSound {
  const made = videoStyleWeMake(style, talkingFootage);
  if (NEEDS_TALKING_FOOTAGE.includes(made)) return "speech";
  const sound = VIDEO_STYLE_SOUND[made];
  return sound === "natural" ? "music" : sound;
}

/** Share of slots that are videos for each content mix (the rest are images, carousels and text). */
export const MIX_VIDEO_SHARE: Record<ContentMix, number> = {
  images: 0,
  "mostly-images": 0.15,
  balanced: 0.45,
  "mostly-videos": 0.7,
};

const IMAGE_BRIEFS: Record<ImageStyle, string> = {
  product: "Product photo: the product or a finished result on a clean, simple background; the item is the hero.",
  life: "Lifestyle: the product or service in a real-life setting where the customer would use it.",
  people: "In use: a person using, wearing or holding the product, or the expert at work.",
  promo: "Offer ad: the product with a strong headline and the price or deal as the focus.",
  tips: "Tips: useful tips, steps, myths vs facts or a list, one idea per slide.",
  review: "Review: a real customer's words (from a stored review) carry the post.",
  ba: "Before and after: the difference the product or service makes, side by side or as a reveal.",
  bts: "Behind the scenes: how it's made, packed or run; the team, tools and process.",
};

const VIDEO_BRIEFS: Record<VideoStyle, string> = {
  showcase: "Showcase: close-ups and details of the product or finished work, cut to music. No voice-over.",
  faceless: "Voice-over explainer: clips that illustrate a voice telling a short story or explaining the benefit.",
  talking: "Talking to camera: a real person from the client's own videos speaks to the viewer in their own voice, with cutaways of the product or work.",
  ugc: "Customer video: a real customer's own words from the client's videos, the product in use, and a review card. Feels real and unpolished.",
  howto: "How-to: show how it works or how to use it, step by step, with a voice guiding each step.",
  bts: "Behind the scenes: the making, packing or work process, set to music. No voice-over.",
  ba: "Before and after: a quick transformation reveal, set to music. No voice-over.",
  slides: "Photo slideshow: the brand's own photos with gentle motion, set to music. No voice-over.",
};

export function styleBrief(style: string, format: StyleFormat): string {
  return format === "video" ? VIDEO_BRIEFS[style as VideoStyle] : IMAGE_BRIEFS[style as ImageStyle];
}

/** Short names for screens (This week, learnings). Same id = same idea in images and videos. */
export const STYLE_NAMES: Record<ImageStyle | VideoStyle, string> = {
  product: "Product photo",
  life: "Lifestyle",
  people: "In use",
  promo: "Offer",
  tips: "Tips",
  review: "Review",
  ba: "Before and after",
  bts: "Behind the scenes",
  showcase: "Showcase",
  faceless: "Voice-over",
  talking: "Talking to camera",
  ugc: "Customer video",
  howto: "How-to",
  slides: "Photo slideshow",
};

export function styleName(style: string | null | undefined): string | null {
  return style ? (STYLE_NAMES[style as ImageStyle | VideoStyle] ?? null) : null;
}

export const isImageStyle =(s: string): s is ImageStyle => (IMAGE_STYLES as readonly string[]).includes(s);
export const isVideoStyle = (s: string): s is VideoStyle => (VIDEO_STYLES as readonly string[]).includes(s);

/**
 * Styles a format may use, in the client's order of priority. No picks means any style. Styles that
 * need people are left out when the client wants none.
 */
export function stylesFor(
  format: StyleFormat,
  picked: { image: ImageStyle[]; video: VideoStyle[] },
  people: PeopleChoice | null,
  /** The client has a video of someone talking to camera (talking and customer-video styles) */
  talkingFootage = false
): (ImageStyle | VideoStyle)[] {
  const all = format === "video" ? (picked.video.length ? picked.video : [...VIDEO_STYLES]) : picked.image.length ? picked.image : [...IMAGE_STYLES];
  const fits = all.filter((s) => (format === "video" ? isVideoStyle(s) : IMAGE_STYLE_FORMATS[s as ImageStyle]?.includes(format)));
  const usable = people === "none" ? fits.filter((s) => !PEOPLE_STYLES.includes(s)) : fits;
  // Videos: styles without the footage they need are made as their stand-in, so drop duplicates
  return format === "video" ? [...new Set((usable as VideoStyle[]).map((s) => videoStyleWeMake(s, talkingFootage)))] : usable;
}
