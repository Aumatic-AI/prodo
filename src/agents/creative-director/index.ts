import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/config/models";
import { AppError } from "@/core/errors";
import type { Brief } from "@/core/creative/brief";
import { updateItem } from "@/core/plans/plans";
import { ai } from "@/providers/ai/registry";
import { creativePrompt, creativeSystem, rawBriefSchema } from "@/prompts/agents/creative-brief";
import type { Task } from "@/agents/weekly/task";
import { assembleBrief } from "./assemble";
import { buildFactBook } from "./book";
import { checkBrief } from "./checks";
import { loadCreativeContext } from "./context";
import { pickFreshHook, saveHook } from "./hooks";

// Agent 6 · Creative Director
// One slot → a production-ready brief: read the facts → write the brief (AI) → map labels and check
// limits (code; one rewrite when something is off) → swap a stale hook (embeddings) → save.

export interface BriefResult {
  brief: Brief;
  /** Code problems still open after the rewrite (QA Gate 1 sees them) */
  problems: string[];
  dropped: number;
}

/** Writes and saves the brief. `round` keeps step ids unique across QA redos. */
export async function writeBrief(
  task: Task,
  db: () => SupabaseClient,
  itemId: string,
  round: number,
  feedback: string[] | null,
  note: string | null
): Promise<BriefResult> {
  const written = await task(
    `brief-write-${round}`,
    async (track) => {
      const { ctx, usage } = await loadCreativeContext(db(), itemId);
      if (usage) track(usage);
      const book = buildFactBook(ctx);
      const format = ctx.item.format;

      let lastProblems: string[] = feedback ?? [];
      let result = null as ReturnType<typeof assembleBrief> | null;
      // One rewrite inside the step when our own checks find something
      for (let pass = 0; pass < 2; pass++) {
        const res = await ai.structured(rawBriefSchema, creativePrompt(book.text, ctx.item.platforms, pass === 0 ? feedback : lastProblems, note), {
          system: creativeSystem(format),
          model: MODELS.creative,
        });
        track(res.usage);
        result = assembleBrief(res.data, format, ctx, book);
        lastProblems = result.brief ? [...result.problems, ...checkBrief(result.brief, ctx)] : result.problems;
        if (result.brief && !lastProblems.length) break;
      }
      if (!result?.brief) throw new AppError(`The brief couldn't be completed: ${lastProblems.slice(0, 3).join(" ")}`, "UNKNOWN", true);
      return { brief: result.brief, problems: lastProblems, dropped: result.dropped };
    },
    (r) => `Wrote a ${r.brief.kind} brief: "${r.brief.hook.text}"${r.dropped ? ` (removed ${r.dropped} unbacked claims)` : ""}`
  );

  const fresh = await task(
    `brief-hook-${round}`,
    async (track) => {
      const res = await pickFreshHook(db(), written.brief, itemId);
      track(res.usage);
      const item = res.brief;
      await saveHook(db(), itemId, item, null, res.embedding);
      await updateItem(db(), itemId, {
        brief: item,
        captions: item.captions,
        hook_type: item.hook.type,
        hook_text: item.hook.text,
        framework: item.framework,
        levers: item.levers.map((l) => l.lever),
        status: "briefed",
        error: null,
      });
      return { brief: item, replaced: res.replaced };
    },
    (r) => (r.replaced ? `Swapped a hook too close to a recent one for "${r.brief.hook.text}"` : "Hook is fresh; saved the brief")
  );

  return { brief: fresh.brief, problems: written.problems, dropped: written.dropped };
}
