import { z } from "zod";

// Brand Strategist: turns the research into the Brand Bible. Every claim cites labels from the
// numbered sources ([A2], [C7], [O1]…). Code maps labels to real ids and drops claims without one.

/** Keeps the items that parse, so one bad item doesn't throw away the whole reply. */
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

const strings = (max: number) => list(z.string().trim().min(1).max(300), max);

const claim = z.object({
  text: z.string().trim().min(1).max(1000),
  sources: z
    .array(z.string())
    .nullish()
    .transform((v) => v ?? []),
});
export type RawClaim = z.infer<typeof claim>;

// ---------- Core sections ----------

export const bibleCoreSchema = z.object({
  positioning: claim,
  valueProp: claim,
  tone: z.object({ summary: claim, traits: list(claim, 6), examples: strings(4) }),
  visualRules: list(claim, 8),
  offerStack: list(z.object({ offering: z.string(), role: z.enum(["hero", "core", "entry", "upsell"]).catch("core"), pitch: claim }), 20),
  do: list(claim, 10),
  dont: list(claim, 10),
  neverSay: strings(40),
});
export type BibleCore = z.infer<typeof bibleCoreSchema>;

const SOURCE_RULES = `Sources: everything you state must come from the numbered sources below. After each claim, list the labels it rests on in "sources", e.g. ["C4", "A1"]. A claim with no label is deleted. Never invent facts, prices, numbers, awards or reviews. Market notes (M) are context only and can't be cited.`;

export const BIBLE_CORE_SYSTEM = `You are a senior brand strategist writing the Brand Bible for a business. Content agents will follow it for every post, ad and video.

${SOURCE_RULES}

Write:
- positioning: one or two sentences: who it's for, what it is, why it's different.
- valueProp: the main promise to the customer, in plain words.
- tone: a summary, 3–5 traits (each a claim, e.g. "Warm and direct: …"), and 3 example sentences written in that tone.
- visualRules: 3–6 rules for images and layout (cite K for the brand kit).
- offerStack: the offerings (O labels) worth promoting, with a role (hero = lead product, core, entry = low-risk first buy, upsell) and a one-line pitch claim. Use only O labels from the list.
- do / dont: 4–8 each, specific to this brand.
- neverSay: words, claims and phrases this brand must never use (include every word from the client's avoid list).

Write in the business's language. Be specific; avoid generic marketing filler.

Return JSON:
{ "positioning": Claim, "valueProp": Claim, "tone": { "summary": Claim, "traits": Claim[], "examples": string[] }, "visualRules": Claim[], "offerStack": [{ "offering": "O1", "role": "hero" | "core" | "entry" | "upsell", "pitch": Claim }], "do": Claim[], "dont": Claim[], "neverSay": string[] }
where Claim = { "text": string, "sources": string[] }`;

// ---------- Personas and pillars ----------

export const audienceSchema = z.object({
  personas: list(
    z.object({
      name: z.string().trim().min(1).max(80),
      summary: z.string().trim().max(600).catch(""),
      pains: strings(6),
      desires: strings(6),
      objections: strings(6),
      triggers: strings(6),
      phrases: strings(6),
      sources: z
        .array(z.string())
        .nullish()
        .transform((v) => v ?? []),
    }),
    5
  ),
  pillars: list(
    z.object({
      name: z.string().trim().min(1).max(80),
      description: z.string().trim().max(400).catch(""),
      share: z.number().min(0).max(100),
      funnelStage: z.enum(["tofu", "mofu", "bofu"]).nullish().catch(null),
      examples: strings(4),
    }),
    6
  ),
});
export type Audience = z.infer<typeof audienceSchema>;

export const AUDIENCE_SYSTEM = `You are a senior brand strategist. From the sources below, write the business's customer personas and content pillars.

${SOURCE_RULES}

- personas: 3 or 4 distinct buyers. For each: a short name ("Busy first-time parent"), a summary, and lists of pains, desires, objections, buying triggers, and phrases they'd actually say. Cite the labels each persona rests on in "sources".
- pillars: 4 or 5 recurring content themes for social media, each with a description, its share of posts (numbers adding up to 100), a funnel stage (tofu = reach new people, mofu = build trust, bofu = drive the sale) and 2–3 example post ideas.

Write in the business's language.

Return JSON:
{ "personas": [{ "name": string, "summary": string, "pains": string[], "desires": string[], "objections": string[], "triggers": string[], "phrases": string[], "sources": string[] }],
  "pillars": [{ "name": string, "description": string, "share": number, "funnelStage": "tofu" | "mofu" | "bofu", "examples": string[] }] }`;

// ---------- Seed hooks ----------

export const seedHooksSchema = z.object({
  hooks: list(
    z.object({
      text: z.string().trim().min(3).max(200),
      hookType: z.string().trim().nullish().transform((v) => v || null),
      pillar: z.string().trim().nullish().transform((v) => v || null),
    }),
    15
  ),
});

export const SEED_HOOKS_SYSTEM = `You write scroll-stopping opening lines (hooks) for a business's short videos and posts.

Write 10 to 15 hooks:
- Each is the first line a viewer sees or hears, under 15 words.
- Mix types: question, bold claim, problem, before/after, curiosity, number list, testimonial, offer.
- Tie each to one of the content pillars (by name).
- Only promise what the sources support. No made-up numbers, prices or reviews. Never use the never-say words.
- Learn from the hooks that already worked (listed below) without copying them.

Return JSON: { "hooks": [{ "text": string, "hookType": string, "pillar": string }] }`;
