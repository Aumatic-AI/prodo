import { env } from "@/config/env";
import { AppError, notConfigured } from "@/core/errors";
import { createAdminClient } from "@/lib/supabase/admin";
import { request, statusError } from "@/providers/http";
import type { ConnectedAccount, PublishResult, PublishStatus, PublishTarget, Publisher } from "./types";

const SERVICE = "Zernio";
export const ZERNIO_API = "https://zernio.com/api/v1";

export function zernioHeaders(): Record<string, string> {
  if (!env.ZERNIO_API_KEY) throw notConfigured(SERVICE);
  return { Authorization: `Bearer ${env.ZERNIO_API_KEY}`, "Content-Type": "application/json" };
}

function platformLabel(platform: string): string {
  return platform === "twitter" ? "X" : platform.charAt(0).toUpperCase() + platform.slice(1);
}

/** Plain message for a platform's own rejection reason. */
function platformError(platform: string, reason: string): string {
  const name = platformLabel(platform);
  if (/token|expired|reauth|disconnect|not connected|permission/i.test(reason)) {
    return `Your ${name} account needs reconnecting. Reconnect it on Accounts, then retry.`;
  }
  if (/duplicate/i.test(reason)) return `${name} rejected this as a duplicate of a recent post. Change the caption and retry.`;
  if (/limit/i.test(reason)) return `${name}'s posting limit is reached. Try again tomorrow.`;
  return `${name} rejected the post: "${reason}"`;
}

export async function zernioCall(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await request(SERVICE, `${ZERNIO_API}${path}`, { ...init, headers: { ...zernioHeaders(), ...init.headers } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 409 && body?.platform) throw new AppError(platformError(body.platform, "duplicate"), "INVALID_INPUT", false);
    const retryAfter = Number(res.headers.get("retry-after")) || undefined;
    throw statusError(SERVICE, res.status, body?.error ?? body?.message, retryAfter);
  }
  return { status: res.status, body };
}

let cachedProfileId: string | null = null;
let pendingProfile: Promise<string> | null = null;

/** Tags this client's profile in Zernio, so a second create finds the first instead of duplicating it. */
function externalId(): string {
  const ref = env.SUPABASE_PROJECT_REF ?? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  return `prodo-${ref}`;
}

/** Creates the client's profile, or returns the one Zernio already has for it. */
async function createProfile(name: string): Promise<string> {
  const tag = externalId();
  const res = await request(SERVICE, `${ZERNIO_API}/profiles`, {
    method: "POST",
    headers: zernioHeaders(),
    body: JSON.stringify({ name, externalId: tag, description: "Created by Prodo" }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.ok && body.profile?._id) return body.profile._id;

  // Already exists: same external id, or same name
  if (res.status === 409) {
    if (body.details?.existingProfileId) return body.details.existingProfileId;
    const { body: list } = await zernioCall("/profiles");
    const found = (list.profiles ?? []).find((p: { externalId?: string }) => p.externalId === tag);
    if (found?._id) return found._id;
  }
  throw statusError(SERVICE, res.ok ? 502 : res.status, body?.error ?? body?.message);
}

async function loadOrCreateProfileId(): Promise<string> {
  const db = createAdminClient();
  const { data: settings, error } = await db.from("app_settings").select("zernio_profile_id").eq("id", 1).single();
  if (error) throw new AppError("Couldn't load settings. Try again.", "PROVIDER_DOWN", true);
  if (settings.zernio_profile_id) return settings.zernio_profile_id;

  const { data: business } = await db.from("business_profile").select("name").eq("id", 1).single();
  const id = await createProfile(business?.name?.trim() || "Prodo");

  const { error: saveError } = await db.from("app_settings").update({ zernio_profile_id: id }).eq("id", 1);
  if (saveError) throw new AppError("Couldn't save the Zernio profile. Try again.", "PROVIDER_DOWN", true);
  return id;
}

/** This client's own Zernio profile: read from app_settings, created on first use. Never the account's default. */
async function clientProfileId(): Promise<string> {
  if (cachedProfileId) return cachedProfileId;
  // Calls that arrive together share one lookup, so only one profile is created
  pendingProfile ??= loadOrCreateProfileId().finally(() => (pendingProfile = null));
  cachedProfileId = await pendingProfile;
  return cachedProfileId;
}

function mediaType(url: string): "image" | "video" {
  return /\.(mp4|mov|webm)(\?|$)/i.test(url) ? "video" : "image";
}

async function createPost(target: PublishTarget, mediaUrls: string[]): Promise<PublishResult> {
  const scheduled = !!target.scheduledDate && new Date(target.scheduledDate).getTime() > Date.now();
  const { body } = await zernioCall("/posts", {
    method: "POST",
    body: JSON.stringify({
      content: target.caption,
      mediaItems: mediaUrls.map((url) => ({ type: mediaType(url), url })),
      platforms: [{ platform: target.platform, accountId: target.accountId }],
      ...(scheduled ? { scheduledFor: new Date(target.scheduledDate!).toISOString(), timezone: "UTC" } : { publishNow: true }),
    }),
  });

  const post = body.post ?? {};
  const entry = (post.platforms ?? [])[0];
  if (entry?.status === "failed") {
    return { success: false, error: platformError(target.platform, entry.errorMessage ?? entry.error ?? "unknown reason") };
  }
  return {
    success: true,
    providerRef: post._id ?? body.postId,
    url: entry?.platformPostUrl,
    scheduled,
  };
}

export class ZernioPublisher implements Publisher {
  id = "zernio";

  publishPhoto(params: PublishTarget & { imageUrl: string }) {
    return createPost(params, [params.imageUrl]);
  }

  publishVideo(params: PublishTarget & { videoUrl: string }) {
    return createPost(params, [params.videoUrl]);
  }

  publishText(params: PublishTarget) {
    return createPost(params, []);
  }

  publishCarousel(params: PublishTarget & { imageUrls: string[] }) {
    return createPost(params, params.imageUrls);
  }

  async getStatus(providerRef: string, platform: string): Promise<PublishStatus> {
    const { body } = await zernioCall(`/posts/${encodeURIComponent(providerRef)}`);
    const post = body.post ?? {};
    const entry = (post.platforms ?? []).find((p: any) => p.platform === platform) ?? post.platforms?.[0] ?? {};
    const state: string = entry.status ?? post.status ?? "pending";

    if (state === "published") {
      return { status: "completed", url: entry.platformPostUrl, providerPostId: post._id, publishedAt: entry.publishedAt ?? post.publishedAt };
    }
    if (state === "failed") {
      return { status: "failed", error: platformError(platform, entry.errorMessage ?? entry.error ?? "unknown reason") };
    }
    return { status: state === "publishing" ? "processing" : "pending" };
  }

  async cancelScheduled(providerRef: string): Promise<{ success: boolean }> {
    try {
      await zernioCall(`/posts/${encodeURIComponent(providerRef)}`, { method: "DELETE" });
    } catch (err) {
      // Already gone upstream
      if (err instanceof AppError && err.type === "INVALID_INPUT") return { success: true };
      throw err;
    }
    return { success: true };
  }

  async listAccounts(): Promise<ConnectedAccount[]> {
    const profileId = await clientProfileId();
    const { body } = await zernioCall(`/accounts?profileId=${encodeURIComponent(profileId)}`);
    return (body.accounts ?? [])
      .filter((a: any) => a.isActive !== false)
      .map((a: any) => ({
        id: a._id,
        platform: a.platform,
        name: a.displayName || a.username || platformLabel(a.platform),
        provider: this.id,
        profileUrl: a.profileUrl,
        avatarUrl: a.profilePicture,
      }));
  }

  async getConnectUrl(platform: string): Promise<string | null> {
    const profileId = await clientProfileId();
    const { body } = await zernioCall(`/connect/${encodeURIComponent(platform)}?profileId=${encodeURIComponent(profileId)}`);
    if (!body.authUrl) throw new AppError("Couldn't get a connect link from Zernio. Try again.", "PROVIDER_DOWN", true);
    return body.authUrl;
  }
}
