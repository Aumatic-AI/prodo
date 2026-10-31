import { z } from "zod";
import { LIMITS } from "@/config/limits";
import { isCountryCode } from "@/config/countries";
import {
  BRAND_RELATIONS,
  BUSINESS_TYPES,
  CONTENT_MIXES,
  CREDENTIAL_KINDS,
  CTA_CHOICES,
  DATE_KINDS,
  GOALS,
  IMAGE_STYLES,
  INDUSTRIES,
  LOGO_CHOICES,
  MAX_GOALS,
  MAX_STYLES,
  MUSIC_MOODS,
  PEOPLE_CHOICES,
  POSTING_PLATFORMS,
  PRICE_MODELS,
  SERVICE_AREAS,
  TEAM_PHOTO_KINDS,
  TONE_AXES,
  VIDEO_STYLES,
  type CtaChoice,
} from "./options";
import type { ScanState } from "./scan";
import type { StepKey } from "./steps";

// One schema per step, used for form errors in the browser and for checks on the server.
// Drafts (z.input) allow empty choices; saved data (z.output) does not.

const id = z.string().uuid();
const text = (max: number) => z.string().trim().max(max, `Keep this under ${max} characters`);
const required = (message: string, max = 200) => z.string().trim().min(1, message).max(max, `Keep this under ${max} characters`);
const link = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/[^\s.]+\.\S+/.test(v), "Enter a full link starting with https://");
const phone = z
  .string()
  .trim()
  .refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a phone number with country code");
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1A2B3C");
const list = (max: number, itemMax = 200) => z.array(z.string().trim().min(1).max(itemMax)).max(max);
const choice = <T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z.enum(values).nullable().refine((v): v is T[number] => v !== null, message);
/** An ordered pick list with no repeats; the first item matters most. */
const ranked = <T extends readonly [string, ...string[]]>(values: T, max: number) =>
  z
    .array(z.enum(values))
    .max(max, `Pick up to ${max}`)
    .refine((v) => new Set(v).size === v.length, "Pick each one once");

/** A file already uploaded to storage. */
export const uploadSchema = z.object({ id, key: z.string().min(1) });
const mediaUploadSchema = uploadSchema.extend({ video: z.boolean() });

// ---------- Start · Website ----------

export const websiteSchema = z.object({ website: link });

// ---------- Step 1 · Your content ----------

export const contentSchema = z.object({
  // In order: the first goal drives most posts
  goals: ranked(GOALS, MAX_GOALS).refine((v) => v.length > 0, "Pick your main goal"),
  mix: choice(CONTENT_MIXES, "Pick images, videos or a mix"),
  postsPerWeek: z
    .record(z.enum(POSTING_PLATFORMS), z.number().int().min(0).max(21))
    .refine((v) => Object.values(v).some((n) => n > 0), "Plan at least one post a week"),
  // Empty = Prodo tries a wide mix and learns what works
  imageStyles: ranked(IMAGE_STYLES, MAX_STYLES),
  videoStyles: ranked(VIDEO_STYLES, MAX_STYLES),
  people: choice(PEOPLE_CHOICES, "Pick who appears in your posts"),
  peoplePhotos: z.array(uploadSchema).max(10, "Up to 10 photos"),
  voiceId: z.string().nullable(),
  voiceName: z.string().nullable(),
  musicMood: z.enum(MUSIC_MOODS),
  logo: z.enum(LOGO_CHOICES),
  ownMedia: z.array(mediaUploadSchema).max(30, "Up to 30 files"),
  references: z.array(mediaUploadSchema).max(8, "Up to 8 files"),
  referenceLinks: z
    .array(
      z
        .string()
        .trim()
        .max(500)
        .regex(/^https?:\/\/[^\s.]+\.\S+/, "Paste a full link starting with https://")
    )
    .max(10, "Up to 10 links"),
  brands: z
    .array(z.object({ id, name: required("Name the brand", 120), link: text(300), relation: z.enum(BRAND_RELATIONS) }))
    .max(6, "Up to 6 brands"),
});

// ---------- Step 2 · Basics ----------

/** Who the business is and where it sells. Settings → Business profile edits the same fields. */
export const profileSchema = z.object({
  name: required("Add your business name", 120),
  logoKey: z.string().nullable(),
  description: z
    .string()
    .trim()
    .min(20, "Write a sentence or two about your business")
    .max(LIMITS.descriptionMaxChars, `Keep this under ${LIMITS.descriptionMaxChars} characters`),
  website: link,
  socials: z.record(z.string(), link),
  businessType: choice(BUSINESS_TYPES, "Pick what you sell"),
  // ISO codes in priority order; the first is the main market
  countries: z
    .array(z.string().refine(isCountryCode, "Pick countries from the list"))
    .min(1, "Pick at least one country")
    .max(30, "Up to 30 countries"),
  cities: text(300),
  language: required("Pick a language", 40),
  timezone: required("Pick a timezone", 60),
  industry: choice(INDUSTRIES, "Pick your industry"),
  currency: z.string().length(3, "Pick a currency"),
});

/** Settings → Business profile: the profile plus the goals from "Your content". */
export const businessProfileSchema = profileSchema.extend({ goals: contentSchema.shape.goals });

/** Where customers go: the choice and its link or number (Basics, and Settings → Content). */
const ctaShape = {
  cta: choice(CTA_CHOICES, "Pick where customers should go"),
  ctaLinks: z.object({ shop: link, whatsapp: phone, book: link, call: phone }),
};

/** The chosen next step needs its link or number. */
function ctaHasLink(b: { cta: CtaChoice; ctaLinks: Record<CtaChoice, string> }, ctx: z.RefinementCtx) {
  if (b.cta && !b.ctaLinks[b.cta]) {
    const isPhone = b.cta === "whatsapp" || b.cta === "call";
    ctx.addIssue({ code: "custom", path: ["ctaLinks", b.cta], message: isPhone ? "Add the phone number" : "Add the link" });
  }
}

/** Settings → Content: the "Your content" choices the weekly agents follow, and where customers go. */
export const contentSettingsSchema = contentSchema
  .pick({ mix: true, imageStyles: true, videoStyles: true, people: true, voiceId: true, voiceName: true, musicMood: true, logo: true })
  .extend(ctaShape)
  .superRefine(ctaHasLink);

export const basicsSchema = profileSchema
  .extend({
    colors: z.object({ primary: hex.nullable(), secondary: hex.nullable(), accent: hex.nullable(), bg: hex, text: hex }),
    fonts: z.object({ heading: z.string().trim().max(80).nullable(), body: z.string().trim().max(80).nullable() }),
    ...ctaShape,
    tone: z.object(Object.fromEntries(TONE_AXES.map((a) => [a, z.number().int().min(0).max(100)])) as Record<
      (typeof TONE_AXES)[number],
      z.ZodNumber
    >),
    avoidWords: list(50, 60),
    disclaimers: list(10, 500),
  })
  .superRefine(ctaHasLink);

// ---------- Step 3A · Products ----------

export const productSchema = z
  .object({
    id,
    name: required("Add the product name"),
    price: z.number().nonnegative("Price can't be negative").nullable(),
    currency: z.string().length(3),
    url: link,
    isHero: z.boolean(),
    photos: z.array(uploadSchema).max(LIMITS.offeringPhotosMax, `Up to ${LIMITS.offeringPhotosMax} photos`),
    benefits: list(10),
    audience: text(500),
    objections: list(10),
    /** Found on the website and not confirmed yet */
    found: z.boolean().optional(),
  })
  .refine((p) => !p.isHero || p.photos.length >= 2, {
    message: "Hero products need at least 2 real photos",
    path: ["photos"],
  });

export const offerSchema = z.object({
  id,
  title: required("Describe the offer"),
  details: text(500),
  offeringId: id.nullable(),
  // Without an end date the offer is used, but never with "ends soon" copy
  endsAt: text(10),
  found: z.boolean().optional(),
});

export const reviewSchema = z.object({
  id,
  content: required("Add what the customer said", 2000),
  author: text(100),
  offeringId: id.nullable(),
  sourceUrl: link,
  found: z.boolean().optional(),
});

export const dateSchema = z.object({
  id,
  name: required("Name the event"),
  date: required("Add the date", 10),
  kind: z.enum(DATE_KINDS),
});

export const productsSchema = z
  .object({
    products: z.array(productSchema).min(1, "Add at least one product").max(LIMITS.offeringsMax, `Up to ${LIMITS.offeringsMax} products`),
    offers: z.array(offerSchema).max(20),
    reviews: z.array(reviewSchema).max(30),
    dates: z.array(dateSchema).max(30),
  })
  .superRefine((v, ctx) => {
    const ids = new Set(v.products.map((p) => p.id));
    v.offers.forEach((o, i) => {
      if (o.offeringId && !ids.has(o.offeringId)) {
        ctx.addIssue({ code: "custom", path: ["offers", i, "offeringId"], message: "Pick a product from your list" });
      }
    });
  });

// ---------- Step 3B · Services ----------

export const serviceSchema = z.object({
  id,
  name: required("Add the service name"),
  priceModel: z.enum(PRICE_MODELS),
  price: z.number().nonnegative("Price can't be negative").nullable(),
  currency: z.string().length(3),
  included: text(1000),
  url: link,
  turnaround: text(100),
  steps: list(8, 300),
  found: z.boolean().optional(),
});

export const caseStudySchema = z.object({
  id,
  client: required("Name the client or project"),
  result: required("Describe the result", 1000),
  photos: z.array(uploadSchema).max(4, "Up to 4 photos"),
});

export const credentialSchema = z.object({
  id,
  kind: z.enum(CREDENTIAL_KINDS),
  content: required("Describe the credential"),
});

export const teamPhotoSchema = uploadSchema.extend({ kind: z.enum(TEAM_PHOTO_KINDS) });

export const servicesSchema = z.object({
  services: z.array(serviceSchema).min(1, "Add at least one service").max(LIMITS.offeringsMax, `Up to ${LIMITS.offeringsMax} services`),
  area: choice(SERVICE_AREAS, "Pick where you serve"),
  areas: text(300),
  caseStudies: z.array(caseStudySchema).max(20),
  yearsInBusiness: z.number().int().min(0).max(200).nullable(),
  credentials: z.array(credentialSchema).max(20),
  teamPhotos: z.array(teamPhotoSchema).max(12, "Up to 12 photos"),
  leadMagnetUrl: link,
  faqs: list(5, 300),
});

export type ContentDraft = z.input<typeof contentSchema>;
export type ProfileDraft = z.input<typeof profileSchema>;
export type BusinessProfileDraft = z.input<typeof businessProfileSchema>;
export type ContentSettingsDraft = z.input<typeof contentSettingsSchema>;
export type BasicsDraft = z.input<typeof basicsSchema>;
export type ProductDraft = z.input<typeof productSchema>;
export type OfferDraft = z.input<typeof offerSchema>;
export type ReviewDraft = z.input<typeof reviewSchema>;
export type DateDraft = z.input<typeof dateSchema>;
export type ProductsDraft = z.input<typeof productsSchema>;
export type ServiceDraft = z.input<typeof serviceSchema>;
export type CaseStudyDraft = z.input<typeof caseStudySchema>;
export type CredentialDraft = z.input<typeof credentialSchema>;
export type TeamPhotoDraft = z.input<typeof teamPhotoSchema>;
export type ServicesDraft = z.input<typeof servicesSchema>;
export type Upload = z.infer<typeof uploadSchema>;
export type MediaUpload = z.infer<typeof mediaUploadSchema>;

export type Content = z.output<typeof contentSchema>;
export type Profile = z.output<typeof profileSchema>;
export type BusinessProfile = z.output<typeof businessProfileSchema>;
export type ContentSettings = z.output<typeof contentSettingsSchema>;
export type Basics = z.output<typeof basicsSchema>;
export type Products = z.output<typeof productsSchema>;
export type Services = z.output<typeof servicesSchema>;

/** Everything the wizard edits, plus how far the client has got. */
export interface OnboardingDraft {
  step: StepKey;
  status: "not_started" | "collecting" | "analyzing" | "review" | "done";
  content: ContentDraft;
  basics: BasicsDraft;
  products: ProductsDraft;
  services: ServicesDraft;
  /** The website read that fills Basics and the products before the client gets there */
  scan: ScanState | null;
}

/** Field errors keyed by path, e.g. "products.0.name". */
export type FieldErrors = Record<string, string>;

export function toFieldErrors(error: z.ZodError): FieldErrors {
  const errors: FieldErrors = {};
  for (const issue of error.issues) {
    const path = issue.path.join(".");
    errors[path] ??= issue.message;
  }
  return errors;
}

/** The schema for the editable steps. Website, connect and review have their own checks. */
export const STEP_SCHEMAS = {
  content: contentSchema,
  basics: basicsSchema,
  products: productsSchema,
  services: servicesSchema,
} as const;
