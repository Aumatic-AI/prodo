import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { LIMITS } from "@/config/limits";
import { adLibraryId, keptLibraryAd } from "@/core/ad-library";
import { AppError } from "@/core/errors";
import { ai } from "@/providers/ai/registry";
import { request } from "@/providers/http";
import { referenceKey } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";

// "Copy a video" from a link instead of an upload: a Meta Ad Library ad (pasted, or picked in the Ad library),
// an Instagram, TikTok or YouTube post, or a direct video file. The video is found and downloaded to be read
// (storage deletes the file after 7 days); what the link's page says about it (text, account, views, likes…)
// is kept with its breakdown.

export type ReferencePlatform = "meta_ad" | "instagram" | "tiktok" | "youtube" | "facebook" | "other";

export interface LinkedReference {
  key: string;
  platform: ReferencePlatform;
  /** The link as it's kept: a Meta ad always as its Ad Library page, so the same ad is recognised next time */
  sourceUrl: string;
  /** What the link's page said about the video */
  meta: Record<string, unknown>;
}

/** The video file behind a link, refused when it isn't one or is too big. */
async function download(videoUrl: string): Promise<{ bytes: Buffer; type: string }> {
  const res = await request("The video's host", videoUrl, {}, LIMITS.downloadTimeoutMs);
  if (!res.ok) throw new AppError(`Couldn't download the video from this link (status ${res.status}). Try again, or upload the video.`, "PROVIDER_DOWN", true);
  const type = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (type && !type.startsWith("video/") && type !== "application/octet-stream") throw new AppError("This link didn't give a video file. Upload the video instead.", "INVALID_INPUT", false);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > LIMITS.videoMaxBytes) throw new AppError("This video is too big (over 100 MB). Upload a shorter one.", "INVALID_INPUT", false);
  return { bytes, type };
}

/** The video behind a pasted or picked link, downloaded to our storage while it's read. */
export async function referenceFromLink(db: SupabaseClient, businessId: string, link: string): Promise<LinkedReference> {
  const url = link.trim();
  const adId = adLibraryId(url);
  let file: { bytes: Buffer; type: string } | null = null;
  let platform: ReferencePlatform = "other";
  let sourceUrl = url;
  let meta: Record<string, unknown> = {};

  if (adId || /facebook\.com\/ads\/library/i.test(url)) {
    platform = "meta_ad";
    if (adId) sourceUrl = `https://www.facebook.com/ads/library/?id=${adId}`;
    // Seen in the Ad library in the last 48 hours: its video link usually still works, which saves a call
    const kept = adId ? await keptLibraryAd(db, adId) : null;
    if (kept) {
      file = await download(kept.videoUrl).catch(() => null);
      meta = { pageName: kept.brand || null, text: kept.text ?? null, startedAt: kept.startedAt ?? null };
    }
    if (!file) {
      const ad = (await ai.ads.metaAd(adId ?? url)).data;
      if (!ad?.videoUrl) throw new AppError("This Meta ad has no video (it may be an image or a carousel ad). Pick a video ad, or upload the video.", "INVALID_INPUT", false);
      meta = { pageName: ad.pageName ?? null, text: ad.text ?? null };
      file = await download(ad.videoUrl);
    }
  } else if (/\.(mp4|mov)(\?|$)/i.test(url)) {
    file = await download(url);
  } else {
    const post = (await ai.social.post(url)).data;
    if (!post?.videoUrl) throw new AppError("Couldn't find a video at this link. Paste a Meta Ad Library, Instagram, TikTok or YouTube video link, or upload the video.", "INVALID_INPUT", false);
    platform = (["instagram", "tiktok", "youtube", "facebook"] as const).find((p) => p === post.platform) ?? "other";
    meta = { caption: post.caption ?? null, publishedAt: post.publishedAt ?? null, views: post.views, likes: post.likes, comments: post.comments, shares: post.shares, saves: post.saves };
    file = await download(post.videoUrl);
  }

  const key = referenceKey(businessId, randomUUID(), file.type === "video/quicktime" ? "mov" : "mp4");
  await upload(key, file.bytes, file.type.startsWith("video/") ? file.type : "video/mp4");
  return { key, platform, sourceUrl, meta };
}

/**
 * The breakdown of a video copied before from the same link, so it isn't watched again (reading a video is
 * the costly part of copying it). Null when it's new or was never read.
 */
export async function earlierBreakdown(db: SupabaseClient, sourceUrl: string) {
  const { data, error } = await db
    .from("reference_videos")
    .select("analysis, summary, duration_sec, analyzed_at")
    .eq("source_url", sourceUrl)
    .not("analysis", "is", null)
    .order("analyzed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}
