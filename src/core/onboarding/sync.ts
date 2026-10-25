import type { SupabaseClient } from "@supabase/supabase-js";
import { furthest, isStep, type StepKey } from "./steps";
import type { OnboardingRaw } from "./load";

export async function upsertRows(db: SupabaseClient, table: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return;
  const { error } = await db.from(table).upsert(rows, { onConflict: "id" });
  if (error) throw error;
}

/**
 * Removes rows the client took out of a list. Brand rows are archived (active = false)
 * because plans and media may point at them; the rest are deleted.
 */
export async function removeMissing(
  db: SupabaseClient,
  table: string,
  existingIds: string[],
  keepIds: string[],
  mode: "archive" | "delete"
) {
  const keep = new Set(keepIds);
  const gone = existingIds.filter((id) => !keep.has(id));
  if (!gone.length) return;
  const query = mode === "archive" ? db.from(table).update({ active: false }) : db.from(table).delete();
  const { error } = await query.in("id", gone);
  if (error) throw error;
}

/** Syncs brand_assets of the given kinds: upserts the list, deletes rows and files that were removed. */
export async function syncAssets(
  db: SupabaseClient,
  existing: { id: string; storage_key: string }[],
  rows: { id: string; storage_key: string; kind: string; offering_id?: string | null; tags?: string[] }[]
) {
  await upsertRows(db, "brand_assets", rows);
  const keep = new Set(rows.map((r) => r.id));
  const gone = existing.filter((a) => !keep.has(a.id));
  if (!gone.length) return;
  const { error } = await db.from("brand_assets").delete().in("id", gone.map((a) => a.id));
  if (error) throw error;
  await db.storage.from("media").remove(gone.map((a) => a.storage_key));
}

/**
 * Saves profile fields together with the raw answers, moves the client's
 * furthest step forward, and marks onboarding as started.
 */
export async function saveProgress(
  db: SupabaseClient,
  step: StepKey,
  fields: Record<string, unknown> = {},
  raw: Partial<OnboardingRaw> = {}
) {
  const { data: current, error: readError } = await db
    .from("business_profile")
    .select("onboarding, onboarding_status")
    .eq("id", 1)
    .single();
  if (readError) throw readError;

  const before: OnboardingRaw = current.onboarding ?? {};
  const reached = before.step && isStep(before.step) ? furthest(before.step, step) : step;

  const { error } = await db
    .from("business_profile")
    .update({
      ...fields,
      onboarding: { ...before, ...raw, step: reached },
      ...(current.onboarding_status === "not_started" ? { onboarding_status: "collecting" } : {}),
    })
    .eq("id", 1);
  if (error) throw error;
}
