import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief } from "@/core/creative/brief";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";

// Hooks too close to ones used recently are swapped for the next fresh option (embedding check),
// and the chosen hook goes into the hook library so later briefs avoid it and the learning loop
// can score it.

export const TOO_SIMILAR = 0.9;
const LOOKBACK_DAYS = 60;

async function closest(db: SupabaseClient, embedding: number[], since: string): Promise<{ text: string; similarity: number } | null> {
  const { data, error } = await db.rpc("match_recent_hooks", { query_embedding: JSON.stringify(embedding), since, match_count: 1 });
  if (error) throw error;
  return data?.[0] ?? null;
}

export interface FreshHook {
  brief: Brief;
  embedding: number[];
  /** The hook it replaced, when the chosen one was too close to a recent hook */
  replaced: string | null;
  usage: Usage;
}

export async function pickFreshHook(db: SupabaseClient, brief: Brief, itemId: string): Promise<FreshHook> {
  const options = [brief.hook, ...brief.hookOptions];
  const vectors = await ai.embed(options.map((h) => h.text));
  const since = new Date(Date.now() - LOOKBACK_DAYS * 86400_000).toISOString();

  // This slot's own earlier hook (a redo) doesn't count as a repeat
  await db.from("hook_library").delete().eq("plan_item_id", itemId);

  for (let i = 0; i < options.length; i++) {
    const near = await closest(db, vectors.data[i], since);
    if (!near || near.similarity < TOO_SIMILAR) {
      const hook = options[i];
      return {
        brief: { ...brief, hook, hookOptions: options.filter((_, j) => j !== i) },
        embedding: vectors.data[i],
        replaced: i === 0 ? null : brief.hook.text,
        usage: vectors.usage,
      };
    }
  }
  // Every option is close to something recent: keep the chosen one; QA weighs freshness
  return { brief, embedding: vectors.data[0], replaced: null, usage: vectors.usage };
}

export async function saveHook(db: SupabaseClient, itemId: string, brief: Brief, platform: string | null, embedding: number[]): Promise<void> {
  const { error } = await db.from("hook_library").insert({
    text: brief.hook.text,
    hook_type: brief.hook.type,
    platform,
    source: "generated",
    plan_item_id: itemId,
    embedding: JSON.stringify(embedding),
  });
  if (error) throw error;
}
