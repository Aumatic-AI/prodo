import { z } from "zod";
import { LIMITS } from "@/config/limits";
import { isCountryCode } from "@/config/countries";
import {
  AUTOPILOT_MODES,
  BUSINESS_TYPES,
  CREDENTIAL_KINDS,
  DATE_KINDS,
  GOALS,
  MUSIC_MOODS,
  POSTING_PLATFORMS,
  PRICE_MODELS,
  SERVICE_AREAS,
  TEAM_PHOTO_KINDS,
  TONE_AXES,
} from "./options";

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
const list = (max: number, itemMax = 200) => z.array(z.string().trim().min(1).max(itemMax)).max(max);
const choice = <T extends readonly [string, ...string[]]>(values: T, message: string) =>
  z.enum(values).nullable().refine((v): v is T[number] => v !== null, message);

/** A file already uploaded to storage. */
export const uploadSchema = z.object({ id, key: z.string().min(1) });

// ---------- Step 1 · Basics ----------

export const basicsSchema = z.object({
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
  primaryGoal: choice(GOALS, "Pick your main goal"),
});

// ---------- Step 2A · Products ----------

export const productSchema = z
  .object({
    id,
    name: required("Add the product name"),
    price: z.number().nonnegative("Price can't be negative").nullable(),
    currency: z.string().length(3),
    url: link,
    isHero: z.boolean(),
    photos: z.array(uploadSchema).max(5, "Up to 5 photos"),
    benefits: list(10),
    audience: text(500),
    objections: list(10),
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
  endsAt: required("Add the end date", 10),
});

export const reviewSchema = z.object({
  id,
  content: required("Add what the customer said", 2000),
  author: text(100),
  offeringId: id.nullable(),
  sourceUrl: link,
});

export const dateSchema = z.object({
  id,
  name: required("Name the event"),
  date: required("Add the date", 10),
  kind: z.enum(DATE_KINDS),
});

export const productsSchema = z
  .object({
    products: z.array(productSchema).min(1, "Add at least one product").max(50),
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

// ---------- Step 2B · Services ----------

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
  services: z.array(serviceSchema).min(1, "Add at least one service").max(50),
  area: choice(SERVICE_AREAS, "Pick where you serve"),
  areas: text(300),
  caseStudies: z.array(caseStudySchema).max(20),
  yearsInBusiness: z.number().int().min(0).max(200).nullable(),
  credentials: z.array(credentialSchema).max(20),
  teamPhotos: z.array(teamPhotoSchema).max(12, "Up to 12 photos"),
  bookingUrl: link,
  whatsapp: z
    .string()
    .trim()
    .refine((v) => v === "" || /^\+?[0-9 ()-]{7,20}$/.test(v), "Enter a phone number with country code"),
  leadMagnetUrl: link,
  faqs: list(5, 300),
});

// ---------- Step 3 · Style and rules ----------

export const styleSchema = z.object({
  tone: z.object(Object.fromEntries(TONE_AXES.map((a) => [a, z.number().int().min(0).max(100)])) as Record<
    (typeof TONE_AXES)[number],
    z.ZodNumber
  >),
  likedBrands: list(3, 100),
  competitors: z
    .array(z.object({ id, name: required("Name the competitor", 120), link: text(300) }))
    .max(5, "Up to 5 competitors"),
  competitorVideos: z.array(uploadSchema).max(4, "Up to 4 videos"),
  avoidWords: list(50, 60),
  disclaimers: list(10, 500),
  postsPerWeek: z
    .record(z.enum(POSTING_PLATFORMS), z.number().int().min(0).max(21))
    .refine((v) => Object.values(v).some((n) => n > 0), "Plan at least one post a week"),
  voiceId: z.string().nullable(),
  voiceName: z.string().nullable(),
  musicMood: z.enum(MUSIC_MOODS),
  autopilotMode: z.enum(AUTOPILOT_MODES),
  planWeekday: z.number().int().min(0).max(6),
  planTime: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  monthlyBudgetUsd: z.number({ invalid_type_error: "Enter a monthly budget" }).min(1, "Budget must be at least $1").max(100_000),
});

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
export type StyleDraft = z.input<typeof styleSchema>;
export type Upload = z.infer<typeof uploadSchema>;

export type Basics = z.output<typeof basicsSchema>;
export type Products = z.output<typeof productsSchema>;
export type Services = z.output<typeof servicesSchema>;
export type Style = z.output<typeof styleSchema>;

/** Everything the wizard edits, plus how far the client has got. */
export interface OnboardingDraft {
  step: import("./steps").StepKey;
  status: "not_started" | "collecting" | "analyzing" | "review" | "done";
  basics: BasicsDraft;
  products: ProductsDraft;
  services: ServicesDraft;
  style: StyleDraft;
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

/** The schema for the editable steps. Connect and review have nothing to validate. */
export const STEP_SCHEMAS = {
  basics: basicsSchema,
  products: productsSchema,
  services: servicesSchema,
  style: styleSchema,
} as const;
