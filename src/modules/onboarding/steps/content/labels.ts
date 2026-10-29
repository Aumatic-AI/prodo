import type { BrandRelation, ContentMix, ImageStyle, LogoChoice, PeopleChoice, VideoStyle } from "@/core/onboarding/options";
import { VIDEO_STYLE_SOUND } from "@/core/onboarding/options";

// Words for the "Your content" step and its review. Services get their own wording for the styles.

export const MIX_OPTIONS: { value: ContentMix; label: string; description: string }[] = [
  { value: "images", label: "Images only", description: "Photos, designs and carousels" },
  { value: "mostly-images", label: "Mostly images", description: "With a video now and then" },
  { value: "balanced", label: "A mix of both", description: "About half and half" },
  { value: "mostly-videos", label: "Mostly videos", description: "Short videos for Reels, TikTok and Shorts" },
];

export const PEOPLE_OPTIONS: { value: PeopleChoice; label: string; description: string }[] = [
  { value: "real", label: "Yes, real people", description: "You, your team or your customers" },
  { value: "ai", label: "Yes, AI-made people", description: "Models made by AI, no photo shoot needed" },
  { value: "none", label: "No people", description: "Only products and places" },
];

export const LOGO_OPTIONS: { value: LogoChoice; label: string; description: string }[] = [
  { value: "every", label: "On every post", description: "Small, in a corner" },
  { value: "never", label: "Never", description: "No logo on your posts" },
];

export const RELATION_OPTIONS: { value: BrandRelation; label: string }[] = [
  { value: "competitor", label: "Competitor" },
  { value: "inspiration", label: "Inspiration" },
];

type Words = { title: string; description: string };

const IMAGE_WORDS: Record<ImageStyle, { product: Words; service: Words }> = {
  product: {
    product: { title: "Product photo", description: "Your product on a clean background" },
    service: { title: "Your work", description: "A finished result, cleanly shot" },
  },
  life: {
    product: { title: "Lifestyle photo", description: "Your product in a real-life setting" },
    service: { title: "Service in action", description: "You working with a client" },
  },
  people: {
    product: { title: "Product in use", description: "Someone using or holding your product" },
    service: { title: "Team or expert", description: "You or your staff, on camera" },
  },
  promo: {
    product: { title: "Product with offer", description: "Product, headline and price or deal" },
    service: { title: "Service with offer", description: "Package, price and Book now" },
  },
  tips: {
    product: { title: "Tips carousel", description: "Swipeable tips, how-tos or lists" },
    service: { title: "Tips carousel", description: "Expert tips, one per slide" },
  },
  review: {
    product: { title: "Customer review", description: "A real customer's words and stars" },
    service: { title: "Client testimonial", description: "A real client's words and stars" },
  },
  ba: {
    product: { title: "Before and after", description: "The difference your product makes" },
    service: { title: "Before and after", description: "The result of your work, side by side" },
  },
  bts: {
    product: { title: "Behind the scenes", description: "How it's made, packed or run" },
    service: { title: "A day at work", description: "Your team, tools and process" },
  },
};

const VIDEO_WORDS: Record<VideoStyle, { product: Words; service: Words }> = {
  showcase: {
    product: { title: "Product showcase", description: "Close-ups and details, set to music" },
    service: { title: "Work showcase", description: "A reel of finished jobs, set to music" },
  },
  faceless: {
    product: { title: "Voice-over explainer", description: "Clips with a voice telling the story" },
    service: { title: "Voice-over explainer", description: "Clips with a voice explaining the service" },
  },
  talking: {
    product: { title: "Talking to camera", description: "Someone speaking straight to viewers" },
    service: { title: "Talking to camera", description: "The expert explains, straight to viewers" },
  },
  ugc: {
    product: { title: "Customer review video", description: "A real customer, filmed on a phone" },
    service: { title: "Client testimonial", description: "A real client, filmed on a phone" },
  },
  howto: {
    product: { title: "How-to / demo", description: "Show how it works, step by step" },
    service: { title: "How it works", description: "Your process, step by step" },
  },
  bts: {
    product: { title: "Behind the scenes", description: "How it's made, packed or run" },
    service: { title: "A day at work", description: "On the job with you and your team" },
  },
  ba: {
    product: { title: "Before and after", description: "A transformation in a few seconds" },
    service: { title: "Transformation", description: "Before and after in a few seconds" },
  },
  slides: {
    product: { title: "Photo slideshow", description: "Your photos with motion and music" },
    service: { title: "Portfolio slideshow", description: "Your best work with motion and music" },
  },
};

const SOUND_LABELS: Record<(typeof VIDEO_STYLE_SOUND)[VideoStyle], string> = {
  music: "Music",
  voice_music: "Voice + music",
  voice: "Voice",
  natural: "Natural sound",
};

export function imageStyleWords(style: ImageStyle, service: boolean): Words {
  return IMAGE_WORDS[style][service ? "service" : "product"];
}

export function videoStyleWords(style: VideoStyle, service: boolean): Words {
  return VIDEO_WORDS[style][service ? "service" : "product"];
}

export function soundLabel(style: VideoStyle): string {
  return SOUND_LABELS[VIDEO_STYLE_SOUND[style]];
}
