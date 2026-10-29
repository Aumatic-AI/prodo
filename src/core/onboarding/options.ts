// Fixed choices used by the wizard schemas and screens.

export const GOALS = ["awareness", "leads", "sales", "bookings", "followers"] as const;
export type Goal = (typeof GOALS)[number];

export const BUSINESS_TYPES = ["product", "service"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const PRICE_MODELS = ["fixed", "from", "hourly", "subscription", "quote"] as const;
export type PriceModel = (typeof PRICE_MODELS)[number];

export const SERVICE_AREAS = ["local", "national", "online"] as const;
export type ServiceArea = (typeof SERVICE_AREAS)[number];

export const DATE_KINDS = ["sale", "launch", "holiday"] as const;
export const CREDENTIAL_KINDS = ["certification", "award"] as const;
export const TEAM_PHOTO_KINDS = ["team", "location", "work"] as const;

export const MUSIC_MOODS = ["upbeat", "calm", "inspiring", "trendy", "corporate"] as const;
export type MusicMood = (typeof MUSIC_MOODS)[number];

export const AUTOPILOT_MODES = ["approve_each", "approve_plan", "full"] as const;
export type AutopilotMode = (typeof AUTOPILOT_MODES)[number];

/** Platforms a client can plan posts for. Keys match publishing platform names. */
export const POSTING_PLATFORMS = ["instagram", "facebook", "youtube", "linkedin", "tiktok", "twitter"] as const;
export type PostingPlatform = (typeof POSTING_PLATFORMS)[number];

/** Social profile links asked for in Basics. */
export const SOCIAL_PLATFORMS = ["instagram", "facebook", "youtube", "linkedin", "tiktok", "twitter", "pinterest", "threads"] as const;

/** Tone sliders: 0 = left word, 100 = the key's word. */
export const TONE_AXES = ["formal", "playful", "bold", "technical"] as const;
export type ToneAxis = (typeof TONE_AXES)[number];

// ---------- Your content ----------

/** Up to this many goals, in order: the first drives most posts. */
export const MAX_GOALS = 2;

export const CONTENT_MIXES = ["images", "mostly-images", "balanced", "mostly-videos"] as const;
export type ContentMix = (typeof CONTENT_MIXES)[number];

export const IMAGE_STYLES = ["product", "life", "people", "promo", "tips", "review", "ba", "bts"] as const;
export type ImageStyle = (typeof IMAGE_STYLES)[number];

export const VIDEO_STYLES = ["showcase", "faceless", "talking", "ugc", "howto", "bts", "ba", "slides"] as const;
export type VideoStyle = (typeof VIDEO_STYLES)[number];

/** Picks per list; the order is the client's priority. */
export const MAX_STYLES = 5;

/** The sound each video style uses. It decides whether we ask for a voice and a music mood. */
export const VIDEO_STYLE_SOUND: Record<VideoStyle, "music" | "voice_music" | "voice" | "natural"> = {
  showcase: "music",
  faceless: "voice_music",
  talking: "voice",
  ugc: "voice",
  howto: "voice_music",
  bts: "natural",
  ba: "music",
  slides: "music",
};

/** What the chosen video styles need. No styles picked = Prodo may use any, so both. */
export function soundNeeds(styles: readonly VideoStyle[]): { voice: boolean; music: boolean } {
  if (!styles.length) return { voice: true, music: true };
  const sounds = styles.map((s) => VIDEO_STYLE_SOUND[s]);
  return {
    voice: sounds.some((s) => s === "voice" || s === "voice_music"),
    music: sounds.some((s) => s === "music" || s === "voice_music"),
  };
}

/** Platforms that only take videos; hidden when the client wants images only. */
export const VIDEO_ONLY_PLATFORMS = ["tiktok", "youtube"] as const;

export const PEOPLE_CHOICES = ["real", "ai", "none"] as const;
export type PeopleChoice = (typeof PEOPLE_CHOICES)[number];

export const LOGO_CHOICES = ["every", "never"] as const;
export type LogoChoice = (typeof LOGO_CHOICES)[number];

export const BRAND_RELATIONS = ["competitor", "inspiration"] as const;
export type BrandRelation = (typeof BRAND_RELATIONS)[number];

// ---------- Basics ----------

/** Where customers go: the one next step on every post. */
export const CTA_CHOICES = ["shop", "whatsapp", "book", "call"] as const;
export type CtaChoice = (typeof CTA_CHOICES)[number];

export const INDUSTRIES = [
  "fashion", "beauty", "health", "food", "home", "fitness", "travel", "education", "finance",
  "real_estate", "tech", "professional", "automotive", "kids", "pets", "art", "events", "other",
] as const;
export type Industry = (typeof INDUSTRIES)[number];

/** Industries whose ads get extra rule checks (health claims, results, money). */
export const SENSITIVE_INDUSTRIES: readonly Industry[] = ["health", "beauty", "finance"];

/** Brand colours the client can check in Basics, in brand_kit.colors. */
export const BRAND_COLOR_KEYS = ["primary", "secondary", "accent", "bg", "text"] as const;
export type BrandColorKey = (typeof BRAND_COLOR_KEYS)[number];
