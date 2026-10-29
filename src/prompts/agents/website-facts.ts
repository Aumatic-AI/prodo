import { z } from "zod";

// Website Analyst: facts from one page of the client's website.

const text = z.string().trim().min(1);
const optionalText = z
  .string()
  .trim()
  .nullish()
  .transform((v) => v || null);
/** A list that drops items the model got wrong instead of rejecting the whole reply. */
const list = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(z.unknown())
    .nullish()
    .transform((values) =>
      (values ?? [])
        .flatMap((value) => {
          const parsed = item.safeParse(value);
          return parsed.success ? [parsed.data as z.output<T>] : [];
        })
        .slice(0, max)
    );

export const pageFactsSchema = z.object({
  offerings: list(
    z.object({
      kind: z.enum(["product", "service"]),
      name: text,
      description: optionalText,
      price: z
        .number()
        .nonnegative()
        .nullish()
        .transform((v) => v ?? null),
      currency: z
        .string()
        .trim()
        .toUpperCase()
        .nullish()
        .transform((v) => (v && /^[A-Z]{3}$/.test(v) ? v : null)),
      priceModel: z
        .enum(["fixed", "from", "hourly", "quote", "subscription"])
        .nullish()
        .transform((v) => v ?? null),
      benefits: list(z.string().trim().min(1), 8),
      url: optionalText,
      // Photos of this offering as shown on the page (relative links are resolved later)
      imageUrls: list(z.string().trim().min(1).max(1000), 5),
      inStock: z
        .boolean()
        .nullish()
        .transform((v) => v ?? null),
    }),
    30
  ),
  offers: list(
    z.object({
      title: text,
      details: optionalText,
      code: optionalText,
      offeringName: optionalText,
      endsAt: z
        .string()
        .nullish()
        .transform((v) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)),
    }),
    10
  ),
  proof: list(
    z.object({
      kind: z.enum(["review", "testimonial", "stat", "award", "certification", "case_study"]),
      content: text,
      author: optionalText,
      rating: z
        .number()
        .min(0)
        .max(5)
        .nullish()
        .transform((v) => v ?? null),
      offeringName: optionalText,
    }),
    20
  ),
});

export type PageFacts = z.infer<typeof pageFactsSchema>;

export const PAGE_FACTS_SYSTEM = `You read one page of a business's own website and pull out facts as JSON.

Rules:
- Only facts written on this page. Never guess, never fill gaps from general knowledge.
- Prices only when the page shows them. Use a number (no symbol) and the ISO currency code if it is clear.
- Keep names exactly as written. Keep the page's language.
- Offerings: products, services, plans or packages that any customer can buy from this business. Not categories, section headings, features, tools used, or blog topics.
- Work done for one specific customer or project (a case study, portfolio piece, client story, before/after) is proof of kind "case_study", never an offering, even when the page gives it a product-like name.
- One case study is one item: put the customer, what was done and the result together. Don't make separate items for its headline, its numbers and its paragraphs.
- imageUrls: up to 5 image links (from the page's ![...](link) images) that show this exact offering itself. Not logos, icons, banners, payment badges or other products. Empty when unsure.
- inStock: false only when the page says this offering is sold out or unavailable; true when it can be bought now; null when the page doesn't say.
- Offers: current deals, discounts, bundles or codes. endsAt only if the page gives a date (YYYY-MM-DD).
- Proof: customer reviews and testimonials (quote them), business-wide numbers like "10,000 customers", awards, certifications, case studies.
- Leave a list empty when the page has nothing for it.

Return JSON:
{
  "offerings": [{ "kind": "product" | "service", "name": string, "description": string | null, "price": number | null, "currency": string | null, "priceModel": "fixed" | "from" | "hourly" | "quote" | "subscription" | null, "benefits": string[], "url": string | null, "imageUrls": string[], "inStock": boolean | null }],
  "offers": [{ "title": string, "details": string | null, "code": string | null, "offeringName": string | null, "endsAt": string | null }],
  "proof": [{ "kind": "review" | "testimonial" | "stat" | "award" | "certification" | "case_study", "content": string, "author": string | null, "rating": number | null, "offeringName": string | null }]
}`;

/** Longest page text sent to the model (about 4,000 tokens). */
const MAX_PAGE_CHARS = 16_000;

export function pageFactsPrompt(page: { url: string; title?: string | null; markdown: string }, brief: string): string {
  return `About the business (from its owner):
${brief}

Page: ${page.url}${page.title ? `\nTitle: ${page.title}` : ""}

Page content:
${page.markdown.slice(0, MAX_PAGE_CHARS)}`;
}
