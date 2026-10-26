import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { AppError, NO_BUSINESS_MESSAGE } from "@/core/errors";
import { inBusinessFolder } from "@/providers/storage/supabase-storage";

// One login owns one business. API routes work through the logged-in client, so RLS limits every
// query to that business; they also need its id for storage paths and for the jobs they start.

export interface CurrentBusiness {
  /** Logged-in client: RLS shows and changes only this business's rows */
  db: SupabaseClient;
  businessId: string;
}

/** The id of the logged-in user's business. `db` must be the logged-in client (RLS returns only their row). */
export async function businessIdOf(db: SupabaseClient): Promise<string> {
  const { data, error } = await db.from("businesses").select("id").maybeSingle();
  if (error) throw error;
  if (!data) throw new AppError(NO_BUSINESS_MESSAGE, "UNAUTHORIZED", false);
  return data.id;
}

/** The logged-in user's business, for API routes. */
export async function currentBusiness(): Promise<CurrentBusiness> {
  const db = await createClient();
  return { db, businessId: await businessIdOf(db) };
}

/**
 * A storage key sent by the browser must be the business's own: in its folder (a new upload) or one
 * of its files already (files from before multi-tenant have no folder). Anything else is refused, so
 * nobody can point at, or later delete, another business's file.
 */
export function assertOwnKey(businessId: string, key: string, alreadyUsed: Iterable<string | null | undefined> = []): void {
  if (inBusinessFolder(businessId, key)) return;
  for (const used of alreadyUsed) if (used === key) return;
  throw new AppError("That file couldn't be found. Please upload it again.", "INVALID_INPUT", false);
}
