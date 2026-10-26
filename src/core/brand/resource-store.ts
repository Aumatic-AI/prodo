import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { assertOwnKey, businessIdOf } from "@/core/business";
import { removeFiles } from "@/providers/storage/remove-files";
import { RESOURCES, resourceSchema, type ResourceDef, type ResourceKey, type ResourceRow } from "./resources";

// Reads and writes Brand Hub lists using the definitions in resources.ts.

const def = (key: ResourceKey): ResourceDef => RESOURCES[key];

/** Dates are stored as timestamps; the forms use YYYY-MM-DD. An end date lasts the whole day. */
function toDb(key: ResourceKey, values: Record<string, unknown>): Record<string, unknown> {
  const row = { ...values };
  for (const field of def(key).fields.filter((f) => f.type === "date")) {
    const v = row[field.key];
    if (typeof v === "string") row[field.key] = field.key.startsWith("ends") ? `${v}T23:59:59Z` : `${v}T00:00:00Z`;
  }
  return row;
}

function fromDb(key: ResourceKey, row: Record<string, unknown>): ResourceRow {
  const out = { ...row } as ResourceRow;
  for (const field of def(key).fields.filter((f) => f.type === "date")) {
    const v = out[field.key];
    if (typeof v === "string") out[field.key] = v.slice(0, 10);
  }
  if (key === "pillars" && out.target_share != null) out.target_share = Number(out.target_share);
  if (key === "offerings" && out.price != null) out.price = Number(out.price);
  return out;
}

export async function listResource(db: SupabaseClient, key: ResourceKey, opts: { archived?: boolean } = {}): Promise<ResourceRow[]> {
  const d = def(key);
  let query = db.from(d.table).select("*");
  if (d.scope) query = query.in(d.scope.column, d.scope.values);
  // Archived rows only on request, except ones found by agents and waiting for the client
  if (d.archive && !opts.archived) query = d.verify ? query.or("active.eq.true,verified.eq.false") : query.eq("active", true);
  for (const o of d.order) query = query.order(o.column, { ascending: o.ascending });
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map((r) => fromDb(key, r));
}

export async function createResource(db: SupabaseClient, key: ResourceKey, body: unknown): Promise<ResourceRow> {
  const values = resourceSchema(key, "create").parse(body);
  // A brand photo or video: only a file the business uploaded itself
  if (typeof values.storage_key === "string") assertOwnKey(await businessIdOf(db), values.storage_key);
  const { data, error } = await db.from(def(key).table).insert(toDb(key, values)).select("*").single();
  if (error) throw error;
  return fromDb(key, data);
}

export async function updateResource(db: SupabaseClient, key: ResourceKey, id: string, body: unknown): Promise<ResourceRow> {
  const values = resourceSchema(key, "update").parse(body);
  // Editing a row found by an agent counts as confirming it
  const confirm = def(key).verify ? { verified: true, ...(def(key).archive && values.active !== false ? { active: true } : {}) } : {};
  const { data, error } = await db
    .from(def(key).table)
    .update({ ...toDb(key, values), ...confirm })
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError("This item no longer exists.", "INVALID_INPUT", false);
  return fromDb(key, data);
}

/** Archives brand rows (plans and media point at them); deletes the rest, with their files for assets. */
export async function removeResource(db: SupabaseClient, key: ResourceKey, id: string): Promise<void> {
  const d = def(key);
  if (d.archive) {
    const { error } = await db.from(d.table).update({ active: false, ...(d.verify ? { verified: true } : {}) }).eq("id", id);
    if (error) throw error;
    return;
  }
  const { data, error } = await db.from(d.table).delete().eq("id", id).select("*").maybeSingle();
  if (error) throw error;
  if (key === "assets" && data?.storage_key) await removeFiles(data.business_id, [data.storage_key]).catch(() => undefined);
}
