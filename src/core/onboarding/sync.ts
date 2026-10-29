import type { SupabaseClient } from "@supabase/supabase-js";
import { furthest, isStep, type StepKey } from "./steps";
import type { OnboardingRaw } from "./load";
import { ownRow } from "@/lib/supabase/own-row";
import { assertOwnKey, businessIdOf } from "@/core/business";
import { removeFiles } from "@/providers/storage/remove-files";

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
  const businessId = await businessIdOf(db);
  const known = new Map(existing.map((a) => [a.id, a.storage_key]));
  for (const row of rows) assertOwnKey(businessId, row.storage_key, [known.get(row.id)]);
  await upsertRows(db, "brand_assets", rows);
  const keep = new Set(rows.map((r) => r.id));
  const gone = existing.filter((a) => !keep.has(a.id));
  if (!gone.length) return;
  const { error } = await db.from("brand_assets").delete().in("id", gone.map((a) => a.id));
  if (error) throw error;
  await removeFiles(businessId, gone.map((a) => a.storage_key));
}

/**
 * Found rows (from the website) the client took out of a list: marked as rejected
 * (active = false, verified = true), so a later website read doesn't offer them again.
 */
export async function rejectFound(db: SupabaseClient, table: string, foundIds: string[], keepIds: string[]) {
  const keep = new Set(keepIds);
  const gone = foundIds.filter((id) => !keep.has(id));
  if (!gone.length) return;
  const { error } = await db.from(table).update({ active: false, verified: true }).in("id", gone);
  if (error) throw error;
}

/**
 * Saves profile fields together with the raw answers, moves the client's
 * furthest step forward, and marks onboarding as started. The raw answers are merged
 * into the onboarding JSON (never replaced), because the website scan writes it too.
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
    .single();
  if (readError) throw readError;

  const before: OnboardingRaw = current.onboarding ?? {};
  const reached = before.step && isStep(before.step) ? furthest(before.step, step) : step;

  const columns = { ...fields, ...(current.onboarding_status === "not_started" ? { onboarding_status: "collecting" } : {}) };
  if (Object.keys(columns).length) {
    const { error } = await ownRow(db.from("business_profile").update(columns));
    if (error) throw error;
  }
  const { error } = await db.rpc("merge_onboarding", { patch: { ...raw, step: reached } });
  if (error) throw error;
}
