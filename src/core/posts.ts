import type { SupabaseClient } from "@supabase/supabase-js";

export type PostStatus = "draft" | "scheduled" | "publishing" | "published" | "partial" | "failed";
export type TargetStatus = "pending" | "sending" | "published" | "failed";

export interface PostMediaSummary {
  type: "image" | "video" | "text";
  storage_key: string | null;
  idea: string | null;
  content: string | null;
}

export interface Post {
  id: string;
  media_id: string;
  status: PostStatus;
  publish_at: string | null;
  created_at: string;
  media: PostMediaSummary | null;
}

export interface PostTarget {
  id: string;
  post_id: string;
  platform: string;
  account_id: string;
  account_name: string;
  caption: string;
  provider: string;
  status: TargetStatus;
  provider_ref: string | null;
  url: string | null;
  error: string | null;
}

export interface PostWithTargets extends Post {
  post_targets: PostTarget[];
}

export async function listPosts(db: SupabaseClient) {
  const { data, error } = await db
    .from("posts")
    .select("*, post_targets(*), media(type, storage_key, idea, content)")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as PostWithTargets[];
}

export async function getPost(db: SupabaseClient, id: string) {
  const { data, error } = await db
    .from("posts")
    .select("*, post_targets(*), media(type, storage_key, idea, content)")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as PostWithTargets;
}

/** Upload-Post rejects a scheduled_date more than 365 days out. */
export const MAX_SCHEDULE_DAYS = 365;

export function validateScheduleDate(publishAt: string): string | null {
  const date = new Date(publishAt);
  if (Number.isNaN(date.getTime())) return "Invalid schedule date";
  const maxDate = new Date(Date.now() + MAX_SCHEDULE_DAYS * 24 * 60 * 60 * 1000);
  if (date > maxDate) return `Scheduled date can't be more than ${MAX_SCHEDULE_DAYS} days out`;
  if (date < new Date()) return "Scheduled date must be in the future";
  return null;
}

export async function createPost(
  db: SupabaseClient,
  input: {
    media_id: string;
    status: PostStatus;
    publish_at?: string | null;
    targets: {
      platform: string;
      account_id: string;
      account_name: string;
      caption: string;
      provider: string;
    }[];
  }
) {
  const { data: post, error: postError } = await db
    .from("posts")
    .insert({
      media_id: input.media_id,
      status: input.status,
      publish_at: input.publish_at || null,
    })
    .select()
    .single();
  if (postError) throw postError;

  if (input.targets.length > 0) {
    const { error: targetsError } = await db.from("post_targets").insert(
      input.targets.map((t) => ({
        post_id: post.id,
        ...t,
      }))
    );
    if (targetsError) throw targetsError;
  }

  return getPost(db, post.id);
}

export async function replacePostTargets(
  db: SupabaseClient,
  postId: string,
  targets: {
    platform: string;
    account_id: string;
    account_name: string;
    caption: string;
    provider: string;
  }[]
) {
  const { error: deleteError } = await db.from("post_targets").delete().eq("post_id", postId);
  if (deleteError) throw deleteError;

  if (targets.length > 0) {
    const { error: insertError } = await db.from("post_targets").insert(
      targets.map((t) => ({ post_id: postId, ...t }))
    );
    if (insertError) throw insertError;
  }
}

export async function updatePost(
  db: SupabaseClient,
  id: string,
  fields: Partial<Pick<Post, "status" | "publish_at">>
) {
  const { error } = await db.from("posts").update(fields).eq("id", id);
  if (error) throw error;
}

export async function deletePost(db: SupabaseClient, id: string) {
  const { error } = await db.from("posts").delete().eq("id", id);
  if (error) throw error;
}
