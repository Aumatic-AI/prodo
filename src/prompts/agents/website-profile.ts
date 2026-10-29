import { z } from "zod";
import { isCountryCode } from "@/config/countries";
import { INDUSTRIES } from "@/core/onboarding/options";

// Website scan: the business's basics, read from its main pages (home, about, contact, policies).

const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null);
const strings = (max: number) =>
  z
    .array(z.unknown())
    .nullish()
    .transform((values) =>
      (values ?? [])
        .filter((v): v is string => typeof v === "string" && !!v.trim())
        .map((v) => v.trim())
        .slice(0, max)
    );
const slider = z
  .number()
  .nullish()
  .transform((v) => (typeof v === "number" ? Math.round(Math.min(100, Math.max(0, v))) : null));

export const profileFactsSchema = z.object({
  name: optionalText,
  description: optionalText,
  businessType: z
    .enum(["product", "service"])
    .nullish()
    .transform((v) => v ?? null),
  countries: strings(5).transform((codes) => codes.map((c) => c.toUpperCase()).filter(isCountryCode)),
  cities: strings(5),
  language: z
    .string()
    .trim()
    .toLowerCase()
    .nullish()
    .transform((v) => (v && /^[a-z]{2}$/.test(v) ? v : null)),
  currency: z
    .string()
    .trim()
    .toUpperCase()
    .nullish()
    .transform((v) => (v && /^[A-Z]{3}$/.test(v) ? v : null)),
  industry: z
    .enum(INDUSTRIES)
    .nullish()
    .catch(null)
    .transform((v) => v ?? null),
  shopUrl: optionalText,
  whatsapp: optionalText,
  bookingUrl: optionalText,
  phone: optionalText,
  disclaimers: strings(3),
  tone: z
    .object({ formal: slider, playful: slider, bold: slider, technical: slider })
    .nullish()
    .transform((v) => v ?? null),
  logoUrl: optionalText,
});

export type ProfileFacts = z.infer<typeof profileFactsSchema>;

export const PROFILE_FACTS_SYSTEM = `You read the main pages of a business's own website and pull out the basics about the business as JSON.

Rules:
- Only what the pages say or clearly show. Never guess; use null or an empty list when unsure.
- name: the business or brand name as written.
- description: 2–3 plain sentences on what the business sells, to whom, and what makes it different, using only facts from the pages. Written in English.
- businessType: "product" when it sells products (a shop), "service" when it sells work done for clients.
- countries: ISO 3166 two-letter codes of where it sells or ships, main market first (where it is based, its address, its currency).
- cities: cities where it has a shop, studio or office.
- language: the two-letter code of the language the site is written in.
- currency: the ISO code of the prices shown.
- industry: one of ${INDUSTRIES.join(", ")}.
- shopUrl: the link to the main shop or "all products" page. bookingUrl: a page or tool to book an appointment.
- whatsapp and phone: numbers as written, with the country code when shown.
- disclaimers: at most 3 short notices an ad must carry, written on the site: legal or cost surprises for the buyer (e.g. "International orders may pay customs and duties", "Results may vary", age limits). Not prices, shipping costs, delivery times, return rules or marketing lines.
- tone: how the site writes, each 0–100: formal (0 casual, 100 formal), playful (0 serious, 100 playful), bold (0 calm, 100 bold), technical (0 simple, 100 technical).
- logoUrl: the link of the business's logo image if one of the pages shows it, else null.

Return JSON:
{ "name": string | null, "description": string | null, "businessType": "product" | "service" | null, "countries": string[], "cities": string[], "language": string | null, "currency": string | null, "industry": string | null, "shopUrl": string | null, "whatsapp": string | null, "bookingUrl": string | null, "phone": string | null, "disclaimers": string[], "tone": { "formal": number, "playful": number, "bold": number, "technical": number } | null, "logoUrl": string | null }`;

/** Text sent per page; about 5 pages fit in one call. */
const MAX_PAGE_CHARS = 5_000;

export function profileFactsPrompt(pages: { url: string; title: string | null; markdown: string }[]): string {
  return pages.map((p) => `Page: ${p.url}${p.title ? `\nTitle: ${p.title}` : ""}\n\n${p.markdown.slice(0, MAX_PAGE_CHARS)}`).join("\n\n---\n\n");
}
