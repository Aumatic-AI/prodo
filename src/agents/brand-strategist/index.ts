import { MODELS } from "@/config/models";
import { saveDraft } from "@/core/brand/bible";
import { ai } from "@/providers/ai/registry";
import { AUDIENCE_SYSTEM, BIBLE_CORE_SYSTEM, SEED_HOOKS_SYSTEM, audienceSchema, bibleCoreSchema, seedHooksSchema } from "@/prompts/agents/brand-bible";
import { optional } from "@/agents/run";
import { defineResearchAgent } from "@/agents/research/define";
import { assembleBible, usesBannedWord } from "./checks";
import { loadStrategistInput, type StrategistInput } from "./inputs";
import { findPassages, type Passage } from "./retrieve";
import { saveSeedHooks } from "./hooks";
import { buildSourceBook } from "./sources";

// Agent 4 · Brand Strategist
// Turns the research into the Brand Bible draft the client reviews.
// load answers and facts → search the Brand Brain per section → write core sections (AI)
// → personas and pillars (AI) → checks (code) → save draft → seed hooks (AI)

export const brandStrategist = defineResearchAgent("brand_strategist", async ({ db, task, note }) => {

  const input = await task("load-facts", async () => loadStrategistInput(db()), (r: StrategistInput) => `Loaded ${r.offerings.length} offerings and ${r.proof.length} proof points`);

  const passages = await task(
    "find-passages",
    async (track) => {
      const res = await findPassages(db());
      track(res.usage);
      return res.passages;
    },
    (r: Passage[]) => `Found ${r.length} relevant passages in the Brand Brain`
  );

  // Same labels in every step: the book is rebuilt from the same saved inputs
  const book = buildSourceBook(input, passages);
  const noteLine = note ? `\n\nThe client asked for changes: "${note}". Follow it unless it breaks the source rules.` : "";
  const prompt = `Business: ${input.businessName} (write in language: ${input.language})${noteLine}\n\n${book.text}`;

  const core = await task(
    "write-core-sections",
    async (track) => {
      const res = await ai.structured(bibleCoreSchema, prompt, { system: BIBLE_CORE_SYSTEM, model: MODELS.analyze });
      track(res.usage);
      return res.data;
    },
    (r) => `Wrote positioning, tone of voice and ${r.offerStack.length} offers for the offer stack`
  );

  const audience = await task(
    "write-personas-and-pillars",
    async (track) => {
      const res = await ai.structured(audienceSchema, prompt, { system: AUDIENCE_SYSTEM, model: MODELS.analyze });
      track(res.usage);
      return res.data;
    },
    (r) => `Wrote ${r.personas.length} customer personas and ${r.pillars.length} content pillars`
  );

  const saved = await task(
    "check-and-save-draft",
    async () => {
      const report = assembleBible(core, audience, book, input.avoidWords, note);
      const version = await saveDraft(db(), report.content);
      return { version: version.version, dropped: report.dropped, neverSay: report.content.never_say, pillars: report.content.pillars.map((p) => p.name) };
    },
    (r) => `Saved Brand Bible draft v${r.version}${r.dropped ? ` (removed ${r.dropped} statements without a source)` : ""}`
  );

  const hooks = await optional(
    task(
      "seed-hooks",
      async (track) => {
        const res = await ai.structured(
          seedHooksSchema,
          `${prompt}\n\nCONTENT PILLARS: ${saved.pillars.join(", ")}\nNEVER SAY: ${saved.neverSay.join(", ") || "none"}\nHOOKS THAT ALREADY WORKED:\n${input.winningHooks.map((h) => `- ${h}`).join("\n") || "none yet"}`,
          { system: SEED_HOOKS_SYSTEM, model: MODELS.analyze }
        );
        track(res.usage);
        const clean = res.data.hooks.filter((h) => !usesBannedWord(h.text, saved.neverSay));
        const stored = await saveSeedHooks(db(), clean);
        track(stored.usage);
        return stored.saved;
      },
      (r) => `Added ${r} starter hooks`
    )
  );

  return `Brand Bible draft v${saved.version} is ready for your review${hooks ? `, with ${hooks} starter hooks` : ""}`;
});
