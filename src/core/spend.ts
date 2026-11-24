import type { SupabaseClient } from "@supabase/supabase-js";

// What the agents spent this calendar month (UTC), from agent_runs. Used by the budget guard and Settings.

export function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/**
 * Added up in the database (month_spend(), migration 0032): reading the rows here stopped at the API's
 * 1,000-row cap, which a busy business passes in a month, so the budget stop under-counted.
 * Works with the logged-in client (its own business) and with businessDb (which passes p_business_id).
 */
export async function monthSpend(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.rpc("month_spend", { p_since: monthStart() });
  if (error) throw error;
  return Number(data ?? 0);
}
