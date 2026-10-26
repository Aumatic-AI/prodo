import type { SupabaseClient } from "@supabase/supabase-js";

export const BUCKET = "media";

// A business's files live under "<business id>/…" (logged-in users can only create files in their
// own folder). Files made before multi-tenant keep their old paths; the database rows say whose
// they are. Shared files that belong to no business: fonts/ (Google Fonts cache), render-jobs/.

/** Storage key inside the business's own folder. */
export function businessKey(businessId: string, path: string): string {
  if (!businessId) throw new Error("A storage key needs a business id");
  return `${businessId}/${path.replace(/^\/+/, "")}`;
}

/** True when the key is in the business's folder: the only keys a client may hand us for new rows. */
export function inBusinessFolder(businessId: string, key: string): boolean {
  return key.startsWith(`${businessId}/`) && !key.includes("..");
}

export function storageKeyFor(businessId: string, type: "image" | "video" | "logo" | "reference", id: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const ext = type === "video" ? "mp4" : "png";
  if (type === "logo") return businessKey(businessId, `logo/${Date.now()}.png`);
  if (type === "reference") return businessKey(businessId, `reference/${Date.now()}.png`);
  return businessKey(businessId, `${type}s/${year}/${month}/${id}.${ext}`);
}

export function urlFor(supabaseUrl: string, key: string): string {
  return `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${key}`;
}

export async function upload(
  db: SupabaseClient,
  key: string,
  file: Blob | Buffer,
  contentType: string
) {
  const { error } = await db.storage.from(BUCKET).upload(key, file, {
    contentType,
    upsert: true,
  });
  if (error) throw error;
}

export async function signedUploadUrl(db: SupabaseClient, key: string) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(key);
  if (error) throw error;
  return data;
}
