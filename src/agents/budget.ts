import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { notify } from "@/core/notifications/notify";
import { monthSpend, monthStart } from "@/core/spend";

export { monthSpend };

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
    await tellOnce(db, budget);
    throw new AppError(`This month's AI budget of $${budget.toFixed(2)} is used up. Raise it in Settings or wait for next month.`, "BUDGET_REACHED", false);
  }
}

/** The client hears once a month that the budget stopped the agents (in-app and by email). */
async function tellOnce(db: SupabaseClient, budget: number): Promise<void> {
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("kind", "budget_reached").gte("created_at", monthStart());
  if (count) return;
  await notify(db, {
    kind: "budget_reached",
    title: "Your monthly AI budget is used up",
    body: `The agents spent this month's $${budget.toFixed(2)} and stopped. Posts already scheduled still go out. Raise the budget in Settings → Automation to continue, or they start again next month.`,
    link: "/settings?tab=automation",
    email: true,
    actionLabel: "Open settings",
  }).catch(() => undefined);
}
