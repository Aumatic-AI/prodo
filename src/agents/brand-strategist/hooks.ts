import type { SupabaseClient } from "@supabase/supabase-js";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";
import { nameKey } from "@/agents/research/text";

/** Saves new starter hooks (source "generated") with their embeddings. Ones already in the library are skipped. */
export async function saveSeedHooks(
  db: SupabaseClient,
  hooks: { text: string; hookType: string | null }[]
): Promise<{ saved: number; usage: Usage[] }> {
  const { data: existing, error } = await db.from("hook_library").select("text");
  if (error) throw error;
  const seen = new Set((existing ?? []).map((h) => nameKey(h.text)));
  const fresh = hooks.filter((h) => {
    const key = nameKey(h.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!fresh.length) return { saved: 0, usage: [] };

  const vectors = await ai.embed(fresh.map((h) => h.text));
  const { error: insertError } = await db
    .from("hook_library")
    .insert(fresh.map((h, i) => ({ text: h.text, hook_type: h.hookType, source: "generated", embedding: JSON.stringify(vectors.data[i]) })));
  if (insertError) throw insertError;
  return { saved: fresh.length, usage: [vectors.usage] };
}
