import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief } from "@/core/creative/brief";
import type { PlanItem } from "@/core/plans/types";
import { LIMITS } from "@/config/limits";
import { AppError } from "@/core/errors";
import { request } from "@/providers/http";
import { publicUrl, workKey } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";
import { loadContentRules } from "@/core/content/prefs";

// Media rows the Producer makes for a slot. One media row per attempt; slides, renditions, voice
// and music files hang off it as media_files.

const TYPE = { static: "image", carousel: "carousel", video: "video", text: "text" } as const;

export async function startMedia(db: SupabaseClient, item: PlanItem, brief: Brief, aspectRatio: string): Promise<string> {
  const rules = await loadContentRules(db);
  const { data, error } = await db
    .from("media")
    .insert({
      type: TYPE[brief.kind],
      source: "generated",
      status: brief.kind === "text" ? "ready" : "generating",
      idea: brief.message,
      content: brief.kind === "text" ? (Object.values(brief.captions)[0] ?? brief.message) : null,
      aspect_ratio: aspectRatio,
      // "Never" in onboarding: no logo on this business's posts
      use_logo: rules.showLogo,
      plan_item_id: item.id,
      offering_id: item.offering_id,
      creative_spec: brief,
    })
    .select("id")
    .single();
  if (error) throw error;
  await db.from("plan_items").update({ status: "producing", error: null }).eq("id", item.id);
  return data.id;
}

export async function saveFile(
  db: SupabaseClient,
  mediaId: string,
  role: "slide" | "rendition" | "thumbnail" | "voice" | "music" | "subtitles",
  key: string,
  body: Buffer,
  contentType: string,
  extra: { position?: number; aspect_ratio?: string } = {}
): Promise<void> {
  await upload(key, body, contentType);
  await db.from("media_files").delete().eq("media_id", mediaId).eq("storage_key", key);
  const { error } = await db.from("media_files").insert({ media_id: mediaId, role, storage_key: key, position: extra.position ?? 0, aspect_ratio: extra.aspect_ratio ?? null });
  if (error) throw error;
}

/** media.cost_usd = everything the agents logged against this media (images, clips, voice, renders, QA). */
export async function syncCost(db: SupabaseClient, mediaId: string): Promise<number> {
  const { data, error } = await db.from("agent_runs").select("cost_usd").eq("media_id", mediaId);
  if (error) throw error;
  const total = Math.round((data ?? []).reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0) * 10000) / 10000;
  await db.from("media").update({ cost_usd: total }).eq("id", mediaId);
  return total;
}

export async function markMediaReady(db: SupabaseClient, mediaId: string, key: string): Promise<void> {
  const { error } = await db.from("media").update({ status: "ready", storage_key: key, error: null }).eq("id", mediaId);
  if (error) throw error;
}

/**
 * Keeps a copy of an AI photo in our storage and returns its public URL. The image provider's own
 * links are temporary and can be slow; the design and the quality check read our copy instead.
 */
export async function keepPhoto(db: SupabaseClient, businessId: string, mediaId: string, url: string, name: string): Promise<string> {
  const res = await request("Image download", url, {}, LIMITS.downloadTimeoutMs);
  if (!res.ok) throw new AppError("Couldn't download the AI photo. Try again.", "PROVIDER_DOWN", true);
  const type = res.headers.get("content-type")?.split(";")[0] || "image/png";
  const key = workKey(businessId, mediaId, `${name}.${type === "image/jpeg" ? "jpg" : type === "image/webp" ? "webp" : "png"}`);
  await saveFile(db, mediaId, "thumbnail", key, Buffer.from(await res.arrayBuffer()), type);
  return publicUrl(key);
}

/** Copies a made file (an AI image or clip link, which expires) into our storage. */
export async function copyToStorage(url: string, key: string): Promise<void> {
  const res = await request("Saving the file", url, {}, LIMITS.downloadTimeoutMs);
  if (!res.ok) throw new AppError("Couldn't download a made scene. Try again.", "PROVIDER_DOWN", true);
  await upload(key, Buffer.from(await res.arrayBuffer()), res.headers.get("content-type")?.split(";")[0] || "application/octet-stream");
}
