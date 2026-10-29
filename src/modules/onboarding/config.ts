import type { StepKey } from "@/core/onboarding/steps";
import type { ResearchAgent } from "@/core/onboarding/research";
import type {
  AutopilotMode,
  BusinessType,
  CtaChoice,
  Industry,
  Goal,
  MusicMood,
  PostingPlatform,
  PriceModel,
  ServiceArea,
  ToneAxis,
} from "@/core/onboarding/options";

export const STEP_META: Record<StepKey, { nav: string; title: string; lead: string }> = {
  website: { nav: "Website", title: "What's your website?", lead: "We'll read it and fill in your products, photos, prices, logo and social profiles for you. You just check them." },
  content: { nav: "Your content", title: "Your content", lead: "What your posts should look and sound like." },
  basics: { nav: "Basics", title: "The basics", lead: "We filled this in from your website. Check it and fix anything that's off." },
  business: { nav: "Your business", title: "Your business", lead: "What you offer and the proof that it works." },
  connect: { nav: "Connect accounts", title: "Connect your accounts", lead: "So we can post for you and learn from what you've already posted." },
  review: { nav: "Review", title: "Review and submit", lead: "Check everything looks right. You can change any of it later." },
};

export const PRODUCTS_META = { nav: "Your products", title: "Your products", lead: "What you sell, what it costs, and the proof that it works." };
export const SERVICES_META = { nav: "Your services", title: "Your services", lead: "What you offer, how it works, and why clients trust you." };

export const BUSINESS_TYPE_OPTIONS: { value: BusinessType; label: string; description: string }[] = [
  { value: "product", label: "Products", description: "Physical or digital products: a shop, D2C brand, packaged goods." },
  { value: "service", label: "Services", description: "Work you do for clients: clinics, agencies, salons, coaching, repairs." },
];

export const GOAL_OPTIONS: { value: Goal; label: string; description: string }[] = [
  { value: "awareness", label: "Awareness", description: "Get seen by more people" },
  { value: "leads", label: "Leads", description: "Enquiries, calls, form fills" },
  { value: "sales", label: "Sales", description: "Orders on your site or store" },
  { value: "bookings", label: "Bookings", description: "Appointments and slots" },
  { value: "followers", label: "Followers", description: "Grow your audience" },
];

/** Where customers go, and the link or number each choice needs. */
export const CTA_OPTIONS: { value: CtaChoice; label: string; description: string; field: string; placeholder: string; phone?: boolean }[] = [
  { value: "shop", label: "Shop on your website", description: "Buy online", field: "Shop page link", placeholder: "https://yourshop.com/collections/all" },
  { value: "whatsapp", label: "WhatsApp", description: "Message you directly", field: "WhatsApp number", placeholder: "+44 7700 900123", phone: true },
  { value: "book", label: "Book online", description: "Pick a time", field: "Booking link", placeholder: "e.g. a Calendly or booking page" },
  { value: "call", label: "Call you", description: "Phone", field: "Phone number", placeholder: "+44 20 7946 0123", phone: true },
];

export const INDUSTRY_OPTIONS: { value: Industry; label: string }[] = [
  { value: "fashion", label: "Fashion and accessories" },
  { value: "beauty", label: "Beauty and personal care" },
  { value: "health", label: "Health and wellness" },
  { value: "food", label: "Food and drink" },
  { value: "home", label: "Home and furniture" },
  { value: "fitness", label: "Fitness and sport" },
  { value: "travel", label: "Travel and hospitality" },
  { value: "education", label: "Education and courses" },
  { value: "finance", label: "Finance and insurance" },
  { value: "real_estate", label: "Real estate" },
  { value: "tech", label: "Technology and software" },
  { value: "professional", label: "Professional services" },
  { value: "automotive", label: "Cars and transport" },
  { value: "kids", label: "Kids and family" },
  { value: "pets", label: "Pets" },
  { value: "art", label: "Art, crafts and gifts" },
  { value: "events", label: "Events and weddings" },
  { value: "other", label: "Something else" },
];

export const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "hi", label: "Hindi" },
  { value: "hinglish", label: "Hinglish" },
  { value: "te", label: "Telugu" },
  { value: "ta", label: "Tamil" },
  { value: "ar", label: "Arabic" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "it", label: "Italian" },
  { value: "mt", label: "Maltese" },
  { value: "pt", label: "Portuguese" },
  { value: "he", label: "Hebrew" },
  { value: "nl", label: "Dutch" },
  { value: "tr", label: "Turkish" },
  { value: "ru", label: "Russian" },
];

export { CURRENCY_OPTIONS, CURRENCY_SYMBOL, currencyFor } from "@/config/currencies";

export const PRICE_MODEL_OPTIONS: { value: PriceModel; label: string }[] = [
  { value: "fixed", label: "Fixed price" },
  { value: "from", label: "Starting from" },
  { value: "hourly", label: "Per hour" },
  { value: "subscription", label: "Monthly / package" },
  { value: "quote", label: "Quote on request" },
];

export const SERVICE_AREA_OPTIONS: { value: ServiceArea; label: string; description: string }[] = [
  { value: "local", label: "Local", description: "In and around your city" },
  { value: "national", label: "National", description: "Anywhere in the country" },
  { value: "online", label: "Online", description: "Delivered remotely" },
];

export const DATE_KIND_OPTIONS = [
  { value: "sale", label: "Sale" },
  { value: "launch", label: "Launch" },
  { value: "holiday", label: "Holiday" },
] as const;

export const CREDENTIAL_KIND_OPTIONS = [
  { value: "certification", label: "Certification" },
  { value: "award", label: "Award" },
] as const;

export const TEAM_PHOTO_KIND_OPTIONS = [
  { value: "team", label: "Team" },
  { value: "location", label: "Place" },
  { value: "work", label: "Our work" },
] as const;

export const SOCIAL_LABELS: Record<string, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  twitter: "X",
  pinterest: "Pinterest",
  threads: "Threads",
};

/** Socials shown before "Add another profile". */
export const DEFAULT_SOCIALS = ["instagram", "facebook", "youtube", "linkedin"];

export const POSTING_LABELS: Record<PostingPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube Shorts",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  twitter: "X",
};

export const TONE_LABELS: Record<ToneAxis, { left: string; right: string }> = {
  formal: { left: "Casual", right: "Formal" },
  playful: { left: "Serious", right: "Playful" },
  bold: { left: "Calm", right: "Bold" },
  technical: { left: "Simple", right: "Technical" },
};

export const MUSIC_OPTIONS: { value: MusicMood; label: string }[] = [
  { value: "upbeat", label: "Upbeat" },
  { value: "calm", label: "Calm" },
  { value: "inspiring", label: "Inspiring" },
  { value: "trendy", label: "Trendy" },
  { value: "corporate", label: "Corporate" },
];

export const AUTOPILOT_OPTIONS: { value: AutopilotMode; label: string; description: string }[] = [
  { value: "approve_each", label: "Approve each post", description: "You approve every post before it goes out." },
  { value: "approve_plan", label: "Approve the weekly plan", description: "Approve the week once; posts go out as planned." },
  { value: "full", label: "Full autopilot", description: "Prodo posts by itself if you don't respond in time." },
];

export const WEEKDAY_OPTIONS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((label, i) => ({
  value: String(i),
  label,
}));

export function timezoneOptions(): { value: string; label: string }[] {
  const zones = typeof Intl.supportedValuesOf === "function" ? Intl.supportedValuesOf("timeZone") : ["UTC"];
  return zones.map((z) => ({ value: z, label: z.replace(/_/g, " ") }));
}

// ---------- Voice library filters (ElevenLabs shared voices) ----------

/** "No filter" value for voice dropdowns (an empty string reads as "nothing selected"). */
export const ANY = "any";

export const VOICE_SORT_OPTIONS = [
  { value: "trending", label: "Trending" },
  { value: "cloned_by_count", label: "Most used" },
  { value: "usage_character_count_1y", label: "Most used this year" },
  { value: "created_date", label: "Newest" },
];

export const VOICE_GENDER_OPTIONS = [
  { value: ANY, label: "Any gender" },
  { value: "female", label: "Female" },
  { value: "male", label: "Male" },
  { value: "neutral", label: "Neutral" },
];

export const VOICE_AGE_OPTIONS = [
  { value: ANY, label: "Any age" },
  { value: "young", label: "Young" },
  { value: "middle_aged", label: "Middle aged" },
  { value: "old", label: "Old" },
];

export const VOICE_CATEGORY_OPTIONS = [
  { value: ANY, label: "Any quality" },
  { value: "professional", label: "Professional" },
  { value: "high_quality", label: "High quality" },
  { value: "famous", label: "Famous" },
];

export const VOICE_USE_CASE_OPTIONS = [
  { value: "advertisement", label: "Advertising" },
  { value: "social_media", label: "Social media" },
  { value: "narrative_story", label: "Narration" },
  { value: "conversational", label: "Conversational" },
  { value: "informative_educational", label: "Educational" },
  { value: "entertainment_tv", label: "Entertainment" },
  { value: "characters_animation", label: "Characters" },
];

const ACCENTS = [
  "american", "british", "australian", "canadian", "irish", "scottish", "south african", "new zealand",
  "indian", "nigerian", "arabic", "spanish", "mexican", "latin american", "french", "german", "italian", "portuguese", "brazilian",
];

export const VOICE_ACCENT_OPTIONS = [
  { value: ANY, label: "Any accent" },
  ...ACCENTS.map((a) => ({ value: a, label: a.replace(/\b\w/g, (c) => c.toUpperCase()) })),
];

const VOICE_LANGUAGES = ["en", "hi", "ar", "es", "fr", "de", "it", "pt", "nl", "pl", "tr", "ru", "ja", "ko", "zh", "ta", "te", "bn", "mr", "id", "fil", "sv", "da", "no", "fi", "el", "cs", "ro", "uk", "vi", "ms"];
const languageNames = new Intl.DisplayNames(["en"], { type: "language" });

export const VOICE_LANGUAGE_OPTIONS = [
  { value: ANY, label: "Any language" },
  ...VOICE_LANGUAGES.map((code) => ({ value: code, label: languageNames.of(code) ?? code })).sort((a, b) => a.label.localeCompare(b.label)),
];

/** Voice library language for the client's content language (Hinglish → Hindi). */
export function voiceLanguageFor(language: string): string {
  const code = language === "hinglish" ? "hi" : language;
  return VOICE_LANGUAGES.includes(code) ? code : "";
}

// ---------- Brand research (progress screen) ----------

export const RESEARCH_AGENT_META: Record<ResearchAgent, { name: string; task: string }> = {
  website_analyst: { name: "Website Analyst", task: "Reads your website for products, services, prices, offers and reviews." },
  visual_identity_analyst: { name: "Visual Identity Analyst", task: "Builds your brand kit: colours, fonts, logo versions and photo style." },
  social_market_analyst: { name: "Social & Market Analyst", task: "Measures your posts and studies your competitors, their ads and hooks." },
  brand_strategist: { name: "Brand Strategist", task: "Writes your Brand Bible: positioning, tone, personas and content pillars." },
};
