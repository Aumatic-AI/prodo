import type { SupabaseClient } from "@supabase/supabase-js";

// What the agents spent this calendar month (UTC), from agent_runs. Used by the budget guard and Settings.

export function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

export async function monthSpend(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.from("agent_runs").select("cost_usd").gte("created_at", monthStart());
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
}
