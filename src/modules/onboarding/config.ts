import type { StepKey } from "@/core/onboarding/steps";
import type { ResearchAgent } from "@/core/onboarding/research";
import type {
  AutopilotMode,
  BusinessType,
  Goal,
  MusicMood,
  PostingPlatform,
  PriceModel,
  ServiceArea,
  ToneAxis,
} from "@/core/onboarding/options";

export const STEP_META: Record<StepKey, { nav: string; title: string; lead: string }> = {
  basics: { nav: "Basics", title: "The basics", lead: "Who you are, where to find you online, and what you want from Prodo." },
  business: { nav: "Your business", title: "Your business", lead: "What you offer and the proof that it works." },
  style: { nav: "Style & rules", title: "Style and rules", lead: "How you sound, what you never say, and how much Prodo does by itself." },
  connect: { nav: "Connect accounts", title: "Connect your accounts", lead: "So we can post for you and learn from what you've already posted." },
  review: { nav: "Review", title: "Review and submit", lead: "Check everything looks right. You can change any of it later." },
};

export const PRODUCTS_META = { nav: "Your products", title: "Your products", lead: "What you sell, what it costs, and the proof that it works." };
export const SERVICES_META = { nav: "Your services", title: "Your services", lead: "What you offer, how it works, and why clients trust you." };

export type WhyItem = { term: string; desc: string };

export const WHY_WE_ASK: Record<StepKey | "products" | "services", WhyItem[]> = {
  basics: [
    { term: "Name and logo", desc: "Every agent uses these. Your logo goes on every ad." },
    { term: "Website", desc: "The Website Analyst reads it for facts, prices and FAQs." },
    { term: "Social profiles", desc: "The Social & Market Analyst studies what already works." },
    { term: "Products or services", desc: "Picks the next step and the ad formats that fit." },
    { term: "Language and timezone", desc: "Copy language, voice-over and posting times." },
    { term: "Main goal", desc: "Content mix, call to action and what counts as success." },
  ],
  business: [],
  products: [
    { term: "Products", desc: "The Planner picks what to promote each week." },
    { term: "Real photos", desc: "The Producer uses them so your real product appears in ads." },
    { term: "Benefits, audience, objections", desc: "The Creative Director builds angles from these." },
    { term: "Offers with end dates", desc: "Urgency copy only while a deal is live." },
    { term: "Reviews", desc: "Social-proof ads, always quoted exactly." },
    { term: "Seasonality", desc: "The Planner times content around these dates." },
  ],
  services: [
    { term: "Services and pricing", desc: "The Planner and the copywriting." },
    { term: "Service area", desc: "Local copy, and Google reviews for local businesses." },
    { term: "Process and turnaround", desc: "How-it-works videos and carousels." },
    { term: "Case studies", desc: "Proof and before/after ads." },
    { term: "Credentials", desc: "Builds authority in ads." },
    { term: "Booking and WhatsApp", desc: "Every call to action links here." },
    { term: "FAQs", desc: "Objection-handling posts." },
  ],
  style: [
    { term: "Tone", desc: "Copywriting and voice choice." },
    { term: "Brands you admire", desc: "The Brand Strategist and your visual style." },
    { term: "Competitors", desc: "We study their angles and find the gaps." },
    { term: "Never-say list", desc: "A hard rule checked on every post." },
    { term: "Posts per week", desc: "How many slots the Planner fills." },
    { term: "Autopilot and budget", desc: "When posts go out, and when agents stop spending." },
  ],
  connect: [
    { term: "Connected accounts", desc: "The Publisher posts here. We also read your past posts and results." },
    { term: "Not stored by us", desc: "Accounts are read live through our publishing partner. We never see your password." },
  ],
  review: [{ term: "Submitting", desc: "Starts the research agents. Your answers stay editable later in Brand and Settings." }],
};

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
];

const EURO_COUNTRIES = ["AT", "BE", "CY", "DE", "EE", "ES", "FI", "FR", "GR", "HR", "IE", "IT", "LT", "LU", "LV", "MT", "NL", "PT", "SI", "SK"];

const COUNTRY_CURRENCY: Record<string, string> = {
  ...Object.fromEntries(EURO_COUNTRIES.map((c) => [c, "EUR"])),
  US: "USD",
  GB: "GBP",
  IN: "INR",
  AE: "AED",
  SA: "SAR",
  QA: "QAR",
  AU: "AUD",
  NZ: "NZD",
  CA: "CAD",
  SG: "SGD",
  CH: "CHF",
  JP: "JPY",
  ZA: "ZAR",
  BR: "BRL",
  MX: "MXN",
};

export const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  INR: "₹",
  AED: "AED",
  SAR: "SAR",
  QAR: "QAR",
  AUD: "A$",
  NZD: "NZ$",
  CAD: "C$",
  SGD: "S$",
  CHF: "CHF",
  JPY: "¥",
  ZAR: "R",
  BRL: "R$",
  MXN: "MX$",
};

export const CURRENCY_OPTIONS = Object.keys(CURRENCY_SYMBOL).map((c) => ({ value: c, label: c }));

/** Currency for new prices, from the main (first) country. */
export function currencyFor(countries: string[]): string {
  return COUNTRY_CURRENCY[countries[0] ?? ""] ?? "USD";
}

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
