import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";

function monthStart(): string {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString();
}

/** Total agent cost this calendar month (UTC). */
export async function monthSpend(db: SupabaseClient): Promise<number> {
  const { data, error } = await db.from("agent_runs").select("cost_usd").gte("created_at", monthStart());
  if (error) throw error;
  return (data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
}

/** Stops agent work when paused or when this month's budget is used up. */
export async function assertBudget(db: SupabaseClient): Promise<void> {
  const { data: settings, error } = await db.from("app_settings").select("paused, monthly_budget_usd").eq("id", 1).single();
  if (error) throw error;

  if (settings.paused) {
    throw new AppError("Prodo is paused. Turn it back on in Settings to continue.", "PAUSED", false);
  }

  const budget = Number(settings.monthly_budget_usd);
  const spent = await monthSpend(db);
  if (spent >= budget) {
    throw new AppError(`This month's AI budget of $${budget.toFixed(2)} is used up. Raise it in Settings or wait for next month.`, "BUDGET_REACHED", false);
  }
}
