import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { findPlanByWeek } from "@/core/plans/plans";
import type { ContentPlan, PlanStrategy } from "@/core/plans/types";
import type { PlannedItem } from "./merge";

/** Statuses after which a slot can't be thrown away by planning again. */
const COMMITTED = ["approved", "scheduled", "published"];

/**
 * The week's plan row, ready for planning: made new, or emptied when the last try failed or the
 * client asked to plan again. A week with approved or scheduled posts is never replanned.
 */
export async function openPlan(db: SupabaseClient, weekStart: string, bibleId: string, replace: boolean): Promise<ContentPlan> {
  const existing = await findPlanByWeek(db, weekStart);
  // A week that only holds single ads: plan it and keep the ads
  if (existing?.strategy?.adhoc && !replace) {
    const { data, error } = await db
      .from("content_plans")
      .update({ status: "planning", brand_bible_id: bibleId, strategy: {}, error: null })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (error) throw error;
    return data as ContentPlan;
  }
  if (existing) {
    const { data: items, error } = await db.from("plan_items").select("id, status").eq("plan_id", existing.id);
    if (error) throw error;
    const committed = (items ?? []).filter((i) => COMMITTED.includes(i.status));
    const canReset = existing.status === "failed" || existing.status === "planning" || !items?.length || replace;
    if (!canReset) throw new AppError("This week already has a plan. Open it on This week, or choose Plan again.", "INVALID_INPUT", false);
    if (committed.length) throw new AppError("Some posts of this week are already approved or scheduled, so the week can't be planned again.", "INVALID_INPUT", false);
    const { error: delError } = await db.from("plan_items").delete().eq("plan_id", existing.id);
    if (delError) throw delError;
    const { data, error: upError } = await db
      .from("content_plans")
      .update({ status: "planning", brand_bible_id: bibleId, strategy: {}, approved_at: null, approval_due_at: null, error: null })
      .eq("id", existing.id)
      .select("*")
      .single();
    if (upError) throw upError;
    return data as ContentPlan;
  }
  const { data, error } = await db.from("content_plans").insert({ week_start: weekStart, brand_bible_id: bibleId, status: "planning" }).select("*").single();
  if (error) throw error;
  return data as ContentPlan;
}

/** Writes the slots and moves the plan on to production. Returns the new item ids in slot order. */
export async function savePlan(db: SupabaseClient, planId: string, items: PlannedItem[], strategy: PlanStrategy): Promise<string[]> {
  const { data, error } = await db
    .from("plan_items")
    .insert(
      items.map((i) => ({
        plan_id: planId,
        slot_at: i.slotAt,
        platforms: i.platforms,
        format: i.format,
        style: i.style,
        pillar_id: i.pillarId,
        persona_id: i.personaId,
        offering_id: i.offeringId,
        offer_id: i.offerId,
        funnel_stage: i.funnelStage,
        objective: i.objective,
        angle: i.angle,
        hook_type: i.hookType,
        levers: i.levers,
        is_experiment: i.isExperiment,
        rationale: i.rationale,
        status: "planned",
      }))
    )
    .select("id, slot_at")
    .order("slot_at");
  if (error) throw error;
  const { error: planError } = await db.from("content_plans").update({ status: "producing", strategy }).eq("id", planId);
  if (planError) throw planError;
  return (data ?? []).map((r) => r.id);
}
