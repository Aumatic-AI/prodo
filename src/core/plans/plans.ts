import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import type { ContentPlan, ItemStatus, PlanItem, PlanItemView, PlanStatus, PlanView } from "./types";

// Reading and updating plans and their slots. Agents use the service-role client; routes the
// logged-in one. Rules (what may change when) live in the callers.

const ITEM_VIEW = `*,
  pillar:content_pillars(name),
  persona:personas(name),
  offering:offerings(name),
  offer:offers(title),
  media:media!plan_items_selected_media_id_fkey(id, type, status, storage_key, error, cost_usd),
  post:posts(id, status)`;

const one = <T>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function toView(row: any): PlanItemView {
  return { ...row, pillar: one(row.pillar), persona: one(row.persona), offering: one(row.offering), offer: one(row.offer), media: one(row.media), post: one(row.post) };
}

export async function getPlan(db: SupabaseClient, id: string): Promise<ContentPlan> {
  const { data, error } = await db.from("content_plans").select("*").eq("id", id).single();
  if (error) throw error;
  return data as ContentPlan;
}

export async function findPlanByWeek(db: SupabaseClient, weekStart: string): Promise<ContentPlan | null> {
  const { data, error } = await db.from("content_plans").select("*").eq("week_start", weekStart).maybeSingle();
  if (error) throw error;
  return (data as ContentPlan) ?? null;
}

/** A plan with its slots in time order, the names behind every id, and what the agents spent on it. */
export async function loadPlanView(db: SupabaseClient, plan: ContentPlan): Promise<PlanView> {
  const [items, runs] = await Promise.all([
    db.from("plan_items").select(ITEM_VIEW).eq("plan_id", plan.id).order("slot_at"),
    db.from("agent_runs").select("cost_usd").eq("plan_id", plan.id),
  ]);
  if (items.error) throw items.error;
  if (runs.error) throw runs.error;
  const costUsd = (runs.data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0);
  return { ...plan, items: (items.data ?? []).map(toView), costUsd: Math.round(costUsd * 100) / 100 };
}

export async function getItem(db: SupabaseClient, id: string): Promise<PlanItem> {
  const { data, error } = await db.from("plan_items").select("*").eq("id", id).single();
  if (error) throw error;
  return data as PlanItem;
}

export async function getItemView(db: SupabaseClient, id: string): Promise<PlanItemView> {
  const { data, error } = await db.from("plan_items").select(ITEM_VIEW).eq("id", id).single();
  if (error) throw error;
  return toView(data);
}

export async function listItems(db: SupabaseClient, planId: string): Promise<PlanItem[]> {
  const { data, error } = await db.from("plan_items").select("*").eq("plan_id", planId).order("slot_at");
  if (error) throw error;
  return (data ?? []) as PlanItem[];
}

/** Slots in a time range across plans (the calendar). */
export async function listItemsBetween(db: SupabaseClient, from: string, to: string): Promise<PlanItemView[]> {
  const { data, error } = await db.from("plan_items").select(ITEM_VIEW).gte("slot_at", from).lt("slot_at", to).order("slot_at");
  if (error) throw error;
  return (data ?? []).map(toView);
}

export async function updateItem(db: SupabaseClient, id: string, fields: Partial<PlanItem>): Promise<void> {
  const { error } = await db.from("plan_items").update(fields).eq("id", id);
  if (error) throw error;
}

export async function setItemStatus(db: SupabaseClient, id: string, status: ItemStatus, error: string | null = null): Promise<void> {
  await updateItem(db, id, { status, error });
}

export async function setPlanStatus(db: SupabaseClient, id: string, status: PlanStatus, fields: Partial<ContentPlan> = {}): Promise<void> {
  const { error } = await db
    .from("content_plans")
    .update({ status, ...fields })
    .eq("id", id);
  if (error) throw error;
}

/** The plan a one-off ad joins: the week's plan, made on the spot when there isn't one. */
export async function planForWeek(db: SupabaseClient, weekStart: string): Promise<ContentPlan> {
  const existing = await findPlanByWeek(db, weekStart);
  if (existing) return existing;
  const { data: bible } = await db.from("brand_bible").select("id").eq("status", "approved").maybeSingle();
  const { data, error } = await db
    .from("content_plans")
    .insert({ week_start: weekStart, brand_bible_id: bible?.id ?? null, status: "producing", strategy: { theme: "Single ads", adhoc: true } })
    .select("*")
    .single();
  // Two requests at once: the other one made it
  if (error?.code === "23505") return (await findPlanByWeek(db, weekStart))!;
  if (error) throw error;
  return data as ContentPlan;
}

/** The approved Brand Bible every content agent follows. */
export async function approvedBible(db: SupabaseClient): Promise<{ id: string; content: any }> {
  const { data, error } = await db.from("brand_bible").select("id, content").eq("status", "approved").maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("Approve your Brand Bible first. The agents follow it for every post.", "INVALID_INPUT", false);
  return data;
}

/**
 * A planned post's media finished outside the agent chain (e.g. an older manual retry): the post
 * takes it, as "needs a look", since it skipped the brief and both quality checks.
 */
export async function adoptFinishedMedia(db: SupabaseClient, mediaId: string): Promise<void> {
  const { data: media } = await db.from("media").select("id, plan_item_id, status").eq("id", mediaId).maybeSingle();
  if (!media?.plan_item_id || media.status !== "ready") return;
  const item = await getItem(db, media.plan_item_id).catch(() => null);
  if (!item || !["failed", "needs_review"].includes(item.status)) return;
  await updateItem(db, item.id, {
    status: "needs_review",
    selected_media_id: media.id,
    error: null,
    qa_report: { ...(item.qa_report ?? {}), reason: "Made outside the agent chain, so it skipped the brief and both quality checks. Look it over, or choose Try again for the full chain." },
  });
}
