import type { SupabaseClient } from "@supabase/supabase-js";

export type MediaType = "image" | "video" | "text";
export type MediaSource = "generated" | "uploaded";
export type MediaStatus = "generating" | "ready" | "failed";
export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface Media {
  id: string;
  type: MediaType;
  source: MediaSource;
  status: MediaStatus;
  idea: string | null;
  content: string | null;
  aspect_ratio: AspectRatio | null;
  use_logo: boolean | null;
  duration_sec: number | null;
  voice_id: string | null;
  voice_name: string | null;
  audio_style: string | null;
  character: string | null;
  language: string | null;
  product: string | null;
  reference_image_key: string | null;
  storage_key: string | null;
  error: string | null;
  created_at: string;
}

export interface CreateMediaInput {
  type: MediaType;
  source: MediaSource;
  status: MediaStatus;
  idea?: string;
  content?: string;
  aspect_ratio?: string;
  use_logo?: boolean;
  duration_sec?: number;
  voice_id?: string;
  voice_name?: string;
  audio_style?: string;
  character?: string;
  language?: string;
  product?: string;
  reference_image_key?: string;
  storage_key?: string;
}

export async function listMedia(db: SupabaseClient, type?: MediaType) {
  let query = db.from("media").select("*").order("created_at", { ascending: false });
  if (type) query = query.eq("type", type);
  const { data, error } = await query;
  if (error) throw error;
  return data as Media[];
}

export async function getMedia(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("media").select("*").eq("id", id).single();
  if (error) throw error;
  return data as Media;
}

export async function createMedia(db: SupabaseClient, input: CreateMediaInput) {
  const { data, error } = await db.from("media").insert(input).select().single();
  if (error) throw error;
  return data as Media;
}

export async function markReady(db: SupabaseClient, id: string, storageKey: string) {
  const { error } = await db
    .from("media")
    .update({ status: "ready" as const, storage_key: storageKey, error: null })
    .eq("id", id);
  if (error) throw error;
}

export async function markFailed(db: SupabaseClient, id: string, message: string) {
  const { error } = await db
    .from("media")
    .update({ status: "failed" as const, error: message })
    .eq("id", id);
  if (error) throw error;
}

export async function markGenerating(db: SupabaseClient, id: string) {
  const { error } = await db
    .from("media")
    .update({ status: "generating" as const, error: null })
    .eq("id", id);
  if (error) throw error;
}

export async function deleteMedia(db: SupabaseClient, id: string) {
  const { error } = await db.from("media").delete().eq("id", id);
  if (error) throw error;
}
