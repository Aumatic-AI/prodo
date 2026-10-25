import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { deleteMedia } from "@/core/media";
import { getItem, getPlan } from "./plans";
import type { PlanItem } from "./types";

// What the client (or full autopilot) can do with a plan and its slots. Every action is also kept as
// feedback, which the learning loop counts. Callers send the matching event (see jobs/client.ts).

async function feedback(db: SupabaseClient, item: PlanItem, action: "approve" | "reject" | "edit" | "regenerate", note: string | null = null) {
  await db.from("feedback").insert({ plan_item_id: item.id, media_id: item.selected_media_id, action, note });
}

/** Approves every slot that passed QA and the plan itself. Slots that need review stay for the client. */
export async function approvePlan(db: SupabaseClient, planId: string): Promise<{ approved: number }> {
  const plan = await getPlan(db, planId);
  if (!["review", "producing", "approved", "scheduled"].includes(plan.status)) {
    throw new AppError("This plan can't be approved now.", "INVALID_INPUT", false);
  }
  const { data: ready, error } = await db.from("plan_items").select("*").eq("plan_id", planId).eq("status", "ready");
  if (error) throw error;
  if (ready?.length) {
    const { error: upError } = await db
      .from("plan_items")
      .update({ status: "approved" })
      .in(
        "id",
        ready.map((i) => i.id)
      );
    if (upError) throw upError;
    await db.from("feedback").insert(ready.map((i) => ({ plan_item_id: i.id, media_id: i.selected_media_id, action: "approve" })));
  }
  const { error: planError } = await db.from("content_plans").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", planId);
  if (planError) throw planError;
  return { approved: ready?.length ?? 0 };
}

export async function approveItem(db: SupabaseClient, itemId: string): Promise<PlanItem> {
  const item = await getItem(db, itemId);
  if (!["ready", "needs_review", "approved"].includes(item.status) || !item.selected_media_id) {
    throw new AppError("Only a finished post can be approved.", "INVALID_INPUT", false);
  }
  const { error } = await db.from("plan_items").update({ status: "approved", error: null }).eq("id", itemId);
  if (error) throw error;
  await feedback(db, item, "approve");
  return { ...item, status: "approved" };
}

export async function rejectItem(db: SupabaseClient, itemId: string, note: string | null): Promise<void> {
  const item = await getItem(db, itemId);
  if (["scheduled", "published"].includes(item.status)) throw new AppError("This post is already scheduled. Cancel it in Posts instead.", "INVALID_INPUT", false);
  const { error } = await db.from("plan_items").update({ status: "rejected" }).eq("id", itemId);
  if (error) throw error;
  await feedback(db, item, "reject", note);
}

/** Puts a slot back to the start so the agents make it again, following the client's note. */
export async function regenerateItem(db: SupabaseClient, itemId: string, note: string | null): Promise<PlanItem> {
  const item = await getItem(db, itemId);
  if (["scheduled", "published"].includes(item.status)) throw new AppError("This post is already scheduled. Cancel it in Posts first.", "INVALID_INPUT", false);
  if (["planned", "briefed", "producing", "qa"].includes(item.status)) throw new AppError("The agents are still working on this post.", "INVALID_INPUT", false);
  await feedback(db, item, "regenerate", note);
  // Failed attempts of this slot are of no use: remove them (and their files) so Media stays clean
  const { data: failed } = await db.from("media").select("id").eq("plan_item_id", itemId).eq("status", "failed");
  for (const m of failed ?? []) await deleteMedia(db, m.id).catch(() => undefined);
  const { error } = await db.from("plan_items").update({ status: "planned", attempts: 0, error: null, brief_score: null, qa_score: null, qa_report: null }).eq("id", itemId);
  if (error) throw error;
  return { ...item, status: "planned" };
}

/** Client edits to captions (kept on the slot and in feedback). */
export async function editCaptions(db: SupabaseClient, itemId: string, captions: Record<string, string>): Promise<void> {
  const item = await getItem(db, itemId);
  if (["scheduled", "published"].includes(item.status)) throw new AppError("This post is already scheduled. Edit it in Posts instead.", "INVALID_INPUT", false);
  const merged = { ...(item.captions ?? {}), ...captions };
  const brief = item.brief ? { ...item.brief, captions: merged } : null;
  const { error } = await db.from("plan_items").update({ captions: merged, brief }).eq("id", itemId);
  if (error) throw error;
  await feedback(db, item, "edit", "Captions edited");
}
