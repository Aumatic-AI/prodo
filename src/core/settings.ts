import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { monthSpend } from "@/agents/budget";

// How the agents behave (app_settings), edited on Settings → Automation.

export const AUTOPILOT_MODES = ["approve_each", "approve_plan", "full"] as const;

export const automationSchema = z.object({
  autopilot_mode: z.enum(AUTOPILOT_MODES),
  paused: z.boolean(),
  plan_weekday: z.number().int().min(0).max(6),
  plan_time: z.string().regex(/^\d{2}:\d{2}$/, "Pick a time"),
  approval_timeout_hours: z.number().int().min(1, "At least 1 hour").max(168, "At most a week"),
  monthly_budget_usd: z.number().min(1, "At least $1").max(100_000),
  notify_email: z
    .string()
    .trim()
    .max(200)
    .refine((v) => v === "" || /^\S+@\S+\.\S+$/.test(v), "Enter an email address")
    .transform((v) => v || null)
    .nullable(),
});
export type Automation = z.infer<typeof automationSchema>;

export interface AutomationView extends Automation {
  /** Agent cost so far this calendar month (UTC) */
  spentThisMonth: number;
}

export async function getAutomation(db: SupabaseClient): Promise<AutomationView> {
  const [{ data, error }, spent] = await Promise.all([db.from("app_settings").select("*").eq("id", 1).single(), monthSpend(db)]);
  if (error) throw error;
  return {
    autopilot_mode: data.autopilot_mode,
    paused: data.paused,
    plan_weekday: data.plan_weekday,
    plan_time: String(data.plan_time).slice(0, 5),
    approval_timeout_hours: data.approval_timeout_hours,
    monthly_budget_usd: Number(data.monthly_budget_usd),
    notify_email: data.notify_email,
    spentThisMonth: Math.round(spent * 100) / 100,
  };
}

export async function saveAutomation(db: SupabaseClient, input: Automation): Promise<AutomationView> {
  const { error } = await db.from("app_settings").update(input).eq("id", 1);
  if (error) throw error;
  return getAutomation(db);
}
