import { z } from "zod";

// Social & Market Analyst: finding competitors and summarising what they do.

// ---------- Discovery ----------

export const competitorPicksSchema = z.object({
  competitors: z
    .array(
      z.object({
        name: z.string().trim().min(1),
        website: z
          .string()
          .trim()
          .nullish()
          .transform((v) => v || null),
      })
    )
    .nullish()
    .transform((v) => v ?? []),
});

export const COMPETITOR_PICKS_SYSTEM = `You pick a business's direct competitors from Google search results.

Rules:
- Only businesses that appear in the results. Never invent one.
- Direct competitors: they sell the same kind of thing to the same customers, in the same market.
- Skip the business itself, marketplaces (Amazon, Etsy), directories and review sites (Yelp, TripAdvisor), media and blog lists, and big global brands unless the business clearly competes with them.
- Use the business's own site as "website" (not a directory page), or null if the results don't show it.
- At most 3, best match first. An empty list is fine.

Return JSON: { "competitors": [{ "name": string, "website": string | null }] }`;

export function competitorPicksPrompt(brief: string, results: { url: string; title: string; description?: string }[], exclude: string[]): string {
  return `${brief}

Already known (don't repeat): ${exclude.join(", ") || "none"}

Search results:
${results.map((r, i) => `${i + 1}. ${r.title}\n   ${r.url}\n   ${r.description ?? ""}`).join("\n")}`;
}

// ---------- Analysis ----------

const strings = z
  .array(z.string().trim().min(1))
  .nullish()
  .transform((v) => (v ?? []).slice(0, 8));

export const competitorAnalysisSchema = z.object({
  positioning: z
    .string()
    .trim()
    .nullish()
    .transform((v) => v || null),
  angles: strings,
  offers: strings,
  formats: strings,
  hooks: strings,
  gaps: strings,
});

export type CompetitorAnalysis = z.infer<typeof competitorAnalysisSchema>;

export const COMPETITOR_ANALYSIS_SYSTEM = `You are a marketing strategist studying one competitor of our client, from public data only: their website, social posts and ads.

Write short, specific notes (each item one line):
- positioning: how they present themselves, in one sentence.
- angles: the selling angles they lean on (e.g. "price", "speed", "luxury feel", "founder story").
- offers: deals and price points they promote, as written.
- formats: content formats that work for them (e.g. "before/after reels", "UGC testimonials", "carousel tips").
- hooks: opening lines from their best posts or ads, quoted.
- gaps: what they don't do or do poorly that our client could own.

Only use what's in the data. These are the competitor's claims, not facts about our client.

Return JSON: { "positioning": string | null, "angles": string[], "offers": string[], "formats": string[], "hooks": string[], "gaps": string[] }`;

export function competitorAnalysisPrompt(clientBrief: string, competitorName: string, research: string): string {
  return `Our client:
${clientBrief}

Competitor: ${competitorName}

${research}`;
}
