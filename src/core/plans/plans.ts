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

/** A plan with its slots in time order, the names behind every id, and the credits it and each post used. */
export async function loadPlanView(db: SupabaseClient, plan: ContentPlan): Promise<PlanView> {
  const items = await db.from("plan_items").select(ITEM_VIEW).eq("plan_id", plan.id).order("slot_at").order("created_at").order("id");
  if (items.error) throw items.error;
  const ids = [plan.id, ...(items.data ?? []).map((i: { id: string }) => i.id)];
  // Charges less refunds, for the plan itself and for each of its posts
  const { data: ledger, error } = await db.from("credit_ledger").select("ref_id, credits").in("ref_id", ids).in("kind", ["charge", "refund"]);
  if (error) throw error;
  const used = new Map<string, number>();
  for (const r of ledger ?? []) used.set(r.ref_id, (used.get(r.ref_id) ?? 0) - Number(r.credits));
  return {
    ...plan,
    items: (items.data ?? []).map((row) => ({ ...toView(row), credits: used.get(row.id) ?? 0 })),
    credits: [...used.values()].reduce((sum, n) => sum + n, 0),
  };
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
  const { data, error } = await db.from("plan_items").select("*").eq("plan_id", planId).order("slot_at").order("created_at").order("id");
  if (error) throw error;
  return (data ?? []) as PlanItem[];
}

/** Slots in a time range across plans (the calendar). */
export async function listItemsBetween(db: SupabaseClient, from: string, to: string): Promise<PlanItemView[]> {
  const { data, error } = await db.from("plan_items").select(ITEM_VIEW).gte("slot_at", from).lt("slot_at", to).order("slot_at").order("created_at").order("id");
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
