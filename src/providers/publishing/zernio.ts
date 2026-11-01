import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { AppError, notConfigured } from "@/core/errors";
import { businessDb } from "@/lib/supabase/business";
import { quoted } from "@/core/error-text";
import { replyError, request, type KnownErrors } from "@/providers/http";
import type { ConnectedAccount, PublishResult, PublishStatus, PublishTarget, Publisher } from "./types";

const SERVICE = "Zernio";
export const ZERNIO_API = "https://zernio.com/api/v1";

export function zernioHeaders(): Record<string, string> {
  if (!env.ZERNIO_API_KEY) throw notConfigured(SERVICE, "ZERNIO_API_KEY is empty on the server");
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

// Its documented error codes (docs.zernio.com/guides/error-handling). Errors are
// { error, code, param, details, platformError }; `code` is stable, `error` is its sentence.
const KNOWN: KnownErrors = {
  missing_credentials: { say: "the API key was missing from the request", type: "NOT_CONFIGURED", retry: false },
  invalid_credentials: { say: "it rejected our API key", type: "NOT_CONFIGURED", retry: false },
  PAYMENT_REQUIRED: { say: "the Zernio plan needs an upgrade or a card", type: "OUT_OF_CREDIT", retry: false },
  analytics_addon_required: { say: "post analytics need Zernio's analytics add-on", type: "NOT_CONFIGURED", retry: false },
  PROFILE_OVER_LIMIT: { say: "this business's Zernio profile is beyond the plan's profile limit", type: "NOT_CONFIGURED", retry: false },
  ACCOUNT_DISCONNECTED: { say: "the social account is disconnected; reconnect it in Settings → Connected accounts", type: "ACCOUNT_DISCONNECTED", retry: false },
  ACCOUNT_NOT_ENABLED_FOR_POSTING: { say: "the account is connected for ads only; reconnect it for posting", type: "ACCOUNT_DISCONNECTED", retry: false },
  insufficient_permissions: { say: "the API key isn't allowed to do this", type: "NOT_CONFIGURED", retry: false },
  feature_not_available: { say: "the Zernio plan doesn't include this", type: "NOT_CONFIGURED", retry: false },
  post_not_found: { say: "the post doesn't exist on Zernio any more", type: "INVALID_INPUT", retry: false },
  account_not_found: { say: "the social account doesn't exist on Zernio any more; reconnect it", type: "ACCOUNT_DISCONNECTED", retry: false },
  missing_required_field: { say: "a field it needs was missing", type: "INVALID_INPUT", retry: false },
  invalid_field_value: { say: "it didn't accept a value we sent", type: "INVALID_INPUT", retry: false },
  invalid_json_body: { say: "it couldn't read the request", type: "INVALID_INPUT", retry: false },
  mutually_exclusive_fields: { say: "two settings we sent can't be used together", type: "INVALID_INPUT", retry: false },
  idempotency_conflict: { say: "the same request is still being processed", type: "RATE_LIMITED", retry: true },
  profile_name_conflict: { say: "a profile with this name already exists", type: "INVALID_INPUT", retry: false },
  profile_external_id_conflict: { say: "this business already has a profile", type: "INVALID_INPUT", retry: false },
  rate_limited: { say: "too many requests; it asked us to wait", type: "RATE_LIMITED", retry: true },
  platform_error: { say: "the social platform rejected it", type: "INVALID_INPUT", retry: false },
  platform_api_error: { say: "the social platform failed to answer", type: "PROVIDER_DOWN", retry: true },
  internal_error: { say: "it had an internal error", type: "PROVIDER_DOWN", retry: true },
  temporarily_unavailable: { say: "it timed out waiting for the platform (the post may have gone through; check before sending again)", type: "PROVIDER_DOWN", retry: true },
};

export async function zernioCall(path: string, init: RequestInit = {}): Promise<{ status: number; body: any }> {
  const res = await request(SERVICE, `${ZERNIO_API}${path}`, { ...init, headers: { ...zernioHeaders(), ...init.headers } });
  const text = await res.text().catch(() => "");
  let body: any = {};
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = {};
  }
  if (!res.ok) {
    if (res.status === 409 && body?.platform) throw new AppError(platformError(body.platform, "duplicate"), "INVALID_INPUT", false);
    // The same content went to the same account in the last 24 hours (this 409 has no code)
    if (res.status === 409 && body?.details?.existingPostId) {
      throw new AppError(`${SERVICE}: the same post went to this account in the last 24 hours (post ${body.details.existingPostId})${quoted(body.error)}.`, "INVALID_INPUT", false);
    }
    // The platform's own words, when Zernio passes them on (Meta's error_user_msg)
    const platformSaid = body?.platformError?.error_user_msg ?? body?.platformError?.message;
    const message = [body?.error ?? body?.message, platformSaid].filter((m) => typeof m === "string" && m).join(" · ") || undefined;
    throw replyError(SERVICE, res, { message, code: body?.code }, text, path.split("?")[0], KNOWN);
  }
  return { status: res.status, body };
}

// Every business has its own Zernio profile (app_settings.zernio_profile_id): its connected accounts
// live there, so one business never sees or posts to another's accounts. One Zernio API key for all.

/** Tags a business's profile in Zernio, so a second create finds the first instead of duplicating it. */
function externalId(businessId: string): string {
  const ref = env.SUPABASE_PROJECT_REF ?? new URL(env.NEXT_PUBLIC_SUPABASE_URL).hostname.split(".")[0];
  return `prodo-${ref}-${businessId}`;
}

/** Creates the business's profile, or returns the one Zernio already has for it (two calls at once both land here). */
async function createProfile(name: string, businessId: string): Promise<string> {
  const tag = externalId(businessId);
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
  if (res.ok) throw new AppError(`${SERVICE} (creating this business's profile) answered without a profile id.`, "PROVIDER_DOWN", true);
  // "Profile limit exceeded" comes as a 403 with no code: the plan's profile cap is reached
  if (res.status === 403 && /profile limit/i.test(body?.error ?? "")) {
    throw new AppError(`${SERVICE}: the plan's profile limit is reached, so this business can't get its own profile${quoted(body.error)}.`, "NOT_CONFIGURED", false);
  }
  throw replyError(SERVICE, res, { message: body?.error ?? body?.message, code: body?.code }, "", "creating this business's profile", KNOWN);
}

/**
 * The business's own Zernio profile: read from its app_settings, created on first use. Never the
 * Zernio account's default profile, and never cached in memory (one server serves every business).
 * `db` is limited to the business (RLS or businessDb).
 */
async function businessProfileId(db: SupabaseClient): Promise<string> {
  const { data: settings, error } = await db.from("app_settings").select("business_id, zernio_profile_id").single();
  if (error) throw new AppError("Couldn't load settings. Try again.", "PROVIDER_DOWN", true);
  if (settings.zernio_profile_id) return settings.zernio_profile_id;

  const { data: business } = await db.from("business_profile").select("name").single();
  const id = await createProfile(business?.name?.trim() || "Prodo", settings.business_id);

  // Only the server may set the profile (migration 0017), so a user can't swap in another business's
  const { error: saveError } = await businessDb(settings.business_id).from("app_settings").update({ zernio_profile_id: id }).eq("business_id", settings.business_id);
  if (saveError) throw new AppError("Couldn't save the Zernio profile. Try again.", "PROVIDER_DOWN", true);
  return id;
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

  async listAccounts(db: SupabaseClient): Promise<ConnectedAccount[]> {
    const profileId = await businessProfileId(db);
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

  async getConnectUrl(db: SupabaseClient, platform: string): Promise<string | null> {
    const profileId = await businessProfileId(db);
    const { body } = await zernioCall(`/connect/${encodeURIComponent(platform)}?profileId=${encodeURIComponent(profileId)}`);
    if (!body.authUrl) throw new AppError("Couldn't get a connect link from Zernio. Try again.", "PROVIDER_DOWN", true);
    return body.authUrl;
  }
}
