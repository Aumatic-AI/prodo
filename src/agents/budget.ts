import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { notify } from "@/core/notifications/notify";
import { monthSpend, monthStart } from "@/core/spend";

export { monthSpend };

/**
 * Stops agent work when paused, or when this month's AI spend reaches the business's safety cap
 * (app_settings.monthly_budget_usd, set in the admin panel). Clients pay with credits; the cap only guards
 * Prodo against runaway costs, so clients never see it as a budget.
 */
export async function assertBudget(db: SupabaseClient): Promise<void> {
  const { data: settings, error } = await db.from("app_settings").select("paused, monthly_budget_usd").single();
  if (error) throw error;

  if (settings.paused) {
    throw new AppError("Prodo is paused. Turn it back on in Settings to continue.", "PAUSED", false);
  }

  const budget = Number(settings.monthly_budget_usd);
  const spent = await monthSpend(db);
  if (spent >= budget) {
    await tellOnce(db);
    throw new AppError("This business reached Prodo's monthly safety limit, so the agents stopped for this month. Ask the Prodo team to raise it.", "BUDGET_REACHED", false);
  }
}

/** The client hears once a month that the safety limit stopped the agents (in-app and by email). */
async function tellOnce(db: SupabaseClient): Promise<void> {
  const { count } = await db.from("notifications").select("id", { count: "exact", head: true }).eq("kind", "budget_reached").gte("created_at", monthStart());
  if (count) return;
  await notify(db, {
    kind: "budget_reached",
    title: "The agents stopped for this month",
    body: "This business reached Prodo's monthly safety limit, so the agents stopped. Posts already scheduled still go out. Ask the Prodo team to raise the limit, or the agents start again next month.",
    link: "/credits",
    email: true,
    actionLabel: "See your credits",
  }).catch(() => undefined);
}
