import type { SupabaseClient } from "@supabase/supabase-js";

const BUCKET = "media";

export function storageKeyFor(type: "image" | "video" | "logo" | "reference", id: string): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const ext = type === "video" ? "mp4" : "png";
  if (type === "logo") return `logo/${Date.now()}.png`;
  if (type === "reference") return `reference/${Date.now()}.png`;
  return `${type}s/${year}/${month}/${id}.${ext}`;
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

export async function remove(db: SupabaseClient, key: string) {
  const { error } = await db.storage.from(BUCKET).remove([key]);
  if (error) throw error;
}

export async function signedUploadUrl(db: SupabaseClient, key: string) {
  const { data, error } = await db.storage.from(BUCKET).createSignedUploadUrl(key);
  if (error) throw error;
  return data;
}
