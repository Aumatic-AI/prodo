import { createAdminClient } from "@/lib/supabase/admin";
import { BUCKET, inBusinessFolder } from "./supabase-storage";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Folders that belong to no business */
const SHARED = ["fonts", "render-jobs"];

/** A file from before multi-tenant: no business folder, not a shared one. */
function unfoldered(key: string): boolean {
  const first = key.split("/")[0];
  return !UUID.test(first) && !SHARED.includes(first) && !key.includes("..");
}

/**
 * Deletes a business's files from storage. Logged-in users may not delete files themselves
 * (migration 0017), so this runs as the server. Whatever a row says, it only deletes keys in the
 * business's own folder, or files from before multi-tenant when the business owns those.
 */
export async function removeFiles(businessId: string, keys: (string | null | undefined)[]): Promise<void> {
  const list = [...new Set(keys.filter((k): k is string => !!k))];
  if (!list.length) return;
  const db = createAdminClient();

  let ownsOld: boolean | null = null;
  const allowed: string[] = [];
  for (const key of list) {
    if (inBusinessFolder(businessId, key)) allowed.push(key);
    else if (unfoldered(key)) {
      if (ownsOld === null) {
        const { data } = await db.from("businesses").select("owns_unfoldered_files").eq("id", businessId).maybeSingle();
        ownsOld = !!data?.owns_unfoldered_files;
      }
      if (ownsOld) allowed.push(key);
    }
  }
  if (!allowed.length) return;
  const { error } = await db.storage.from(BUCKET).remove(allowed);
  if (error) throw error;
}
