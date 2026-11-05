import { randomUUID } from "node:crypto";
import { LIMITS } from "@/config/limits";
import { AppError } from "@/core/errors";
import { ai } from "@/providers/ai/registry";
import { request } from "@/providers/http";
import { brandKey } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";

// "Copy a video" from a link instead of an upload: a Meta Ad Library ad, an Instagram, TikTok or YouTube post,
// or a direct video file. The video is found, downloaded and kept in the brand's references, like an upload.

const isAdLibrary = (link: string) => /facebook\.com\/ads\/library/i.test(link) || /^\d{6,}$/.test(link.trim());

/** The video behind a pasted link, kept in our storage. Returns its storage key. */
export async function referenceFromLink(businessId: string, link: string): Promise<string> {
  const url = link.trim();
  let videoUrl: string | null = null;
  if (isAdLibrary(url)) {
    videoUrl = (await ai.ads.metaAd(url)).data?.videoUrl ?? null;
    if (!videoUrl) throw new AppError("This Meta ad has no video (it may be an image or a carousel ad). Paste a video ad, or upload the video.", "INVALID_INPUT", false);
  } else if (/\.(mp4|mov)(\?|$)/i.test(url)) {
    videoUrl = url;
  } else {
    videoUrl = (await ai.social.post(url)).data?.videoUrl ?? null;
    if (!videoUrl) throw new AppError("Couldn't find a video at this link. Paste a Meta Ad Library, Instagram, TikTok or YouTube video link, or upload the video.", "INVALID_INPUT", false);
  }

  const res = await request("The video's host", videoUrl, {}, LIMITS.downloadTimeoutMs);
  if (!res.ok) throw new AppError(`Couldn't download the video from this link (status ${res.status}). Try again, or upload the video.`, "PROVIDER_DOWN", true);
  const type = res.headers.get("content-type")?.split(";")[0] ?? "";
  if (type && !type.startsWith("video/") && type !== "application/octet-stream") throw new AppError("This link didn't give a video file. Upload the video instead.", "INVALID_INPUT", false);
  const bytes = Buffer.from(await res.arrayBuffer());
  if (bytes.length > LIMITS.videoMaxBytes) throw new AppError("This video is too big (over 100 MB). Upload a shorter one.", "INVALID_INPUT", false);
  const key = brandKey(businessId, "references", randomUUID(), type === "video/quicktime" ? "mov" : "mp4");
  await upload(key, bytes, type.startsWith("video/") ? type : "video/mp4");
  return key;
}
