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
