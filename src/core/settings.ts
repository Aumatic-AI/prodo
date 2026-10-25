import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { monthSpend } from "@/core/spend";
import { POSTING_PLATFORMS } from "@/core/onboarding/options";

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
  /** Posts per week per platform (business_profile.posting_prefs.platforms): the Planner's slot count */
  posts_per_week: z
    .record(z.enum(POSTING_PLATFORMS), z.number().int().min(0).max(21))
    .refine((v) => Object.values(v).some((n) => n > 0), "Plan at least one post a week"),
});
export type Automation = z.infer<typeof automationSchema>;

export interface AutomationView extends Automation {
  /** Agent cost so far this calendar month (UTC) */
  spentThisMonth: number;
}

export async function getAutomation(db: SupabaseClient): Promise<AutomationView> {
  const [{ data, error }, spent, profile] = await Promise.all([
    db.from("app_settings").select("*").eq("id", 1).single(),
    monthSpend(db),
    db.from("business_profile").select("posting_prefs").eq("id", 1).single(),
  ]);
  if (error) throw error;
  const posting = (profile.data?.posting_prefs?.platforms ?? {}) as Record<string, number>;
  return {
    autopilot_mode: data.autopilot_mode,
    paused: data.paused,
    plan_weekday: data.plan_weekday,
    plan_time: String(data.plan_time).slice(0, 5),
    approval_timeout_hours: data.approval_timeout_hours,
    monthly_budget_usd: Number(data.monthly_budget_usd),
    notify_email: data.notify_email,
    posts_per_week: Object.fromEntries(POSTING_PLATFORMS.map((p) => [p, Number(posting[p] ?? 0)])) as Automation["posts_per_week"],
    spentThisMonth: Math.round(spent * 100) / 100,
  };
}

export async function saveAutomation(db: SupabaseClient, input: Automation): Promise<AutomationView> {
  const { posts_per_week, ...settings } = input;
  const { error } = await db.from("app_settings").update(settings).eq("id", 1);
  if (error) throw error;
  const { data: profile } = await db.from("business_profile").select("posting_prefs").eq("id", 1).single();
  const { error: prefsError } = await db
    .from("business_profile")
    .update({ posting_prefs: { ...(profile?.posting_prefs ?? {}), platforms: posts_per_week } })
    .eq("id", 1);
  if (prefsError) throw prefsError;
  return getAutomation(db);
}
