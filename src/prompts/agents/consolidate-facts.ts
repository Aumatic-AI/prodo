import { z } from "zod";

// Website Analyst, last step: before saving what the website showed, find what repeats.
// The model only labels items; it never rewrites them, so every kept item stays word for word.

export const DECISIONS = ["keep", "duplicate", "already_known", "not_an_offering"] as const;

export const consolidateSchema = z.object({
  items: z
    .array(z.unknown())
    .nullish()
    .transform((values) =>
      (values ?? []).flatMap((value) => {
        const parsed = z
          .object({
            id: z.string().trim(),
            decision: z.enum(DECISIONS),
            sameAs: z.string().trim().nullish().transform((v) => v || null),
          })
          .safeParse(value);
        return parsed.success ? [parsed.data] : [];
      })
    ),
});

export type ConsolidateDecision = z.infer<typeof consolidateSchema>["items"][number];

export const CONSOLIDATE_SYSTEM = `You clean up facts read from a business's website before the owner reviews them.

You get two lists:
- KNOWN [K…]: what the owner already entered or confirmed.
- FOUND [F…]: what was read from the website, page by page. The same thing is often shown on several pages in different words (a short teaser on the home page, a longer version on its own page).

For every FOUND item, decide:
- "keep": new information.
- "duplicate": describes the same thing as another FOUND item. Set sameAs to the FOUND item to keep: the most complete one. A short item whose information is fully inside a longer item (a headline, a single number from a case study) is a duplicate of the longer one.
- "already_known": the same thing as a KNOWN item. Set sameAs to that K item.
- "not_an_offering": only for offerings. Use it when the item is not something any customer can buy: work done for one specific customer or project, a feature, a tool, a section heading.

Judge by meaning, not wording. Different products, services or customers are different items even when they sound alike. When unsure, keep.

Return JSON: { "items": [{ "id": "F1", "decision": "keep" | "duplicate" | "already_known" | "not_an_offering", "sameAs": "F2" | "K1" | null }] }`;
