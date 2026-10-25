import type { ConnectedAccount, PublishResult, PublishTarget, Publisher } from "./types";
import { AppError } from "@/core/errors";
import { request } from "@/providers/http";

const BASE_URL = "https://api.upload-post.com/api";

function apiKey(): string {
  const key = process.env.UPLOAD_POST_API_KEY;
  if (!key) throw new AppError("Upload-Post API key not configured", "PROVIDER_DOWN", false);
  return key;
}

function profileUsername(): string {
  const user = process.env.UPLOAD_POST_PROFILE;
  if (!user) throw new AppError("Upload-Post profile (UPLOAD_POST_PROFILE) not configured", "PROVIDER_DOWN", false);
  return user;
}

function authHeader(): Record<string, string> {
  return { Authorization: `Apikey ${apiKey()}` };
}

async function parseOrThrow(res: Response) {
  const data = await res.json().catch(() => ({}));
  // 202 (scheduled) is a success case even though it's not res.ok's 2xx-only view in some runtimes.
  if (!res.ok && res.status !== 202) {
    const msg = data?.message || data?.error || `Upload-Post error (${res.status})`;
    if (res.status === 429) {
      throw new AppError("Upload-Post rate limit — try again shortly", "RATE_LIMITED", true, 30_000);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AppError("Upload-Post account disconnected or key invalid", "ACCOUNT_DISCONNECTED", false);
    }
    throw new AppError(msg, "PROVIDER_DOWN", res.status >= 500);
  }
  if (data?.success === false) {
    throw new AppError(data?.message || data?.error || "Upload-Post request failed", "PROVIDER_DOWN", false);
  }
  return data;
}

async function get<T>(path: string, params?: Record<string, string | undefined>): Promise<T> {
  const url = new URL(`${BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
  }
  const res = await request("Upload-Post", url.toString(), { headers: authHeader() });
  return parseOrThrow(res);
}

async function postForm<T>(path: string, form: FormData): Promise<T> {
  const res = await request("Upload-Post", `${BASE_URL}${path}`, { method: "POST", headers: authHeader(), body: form });
  return parseOrThrow(res);
}

async function del<T>(path: string): Promise<T> {
  const res = await request("Upload-Post", `${BASE_URL}${path}`, { method: "DELETE", headers: authHeader() });
  return parseOrThrow(res);
}

function profileUrlFor(platform: string, handle?: string): string | undefined {
  if (!handle) return undefined;
  switch (platform) {
    case "instagram":
      return `https://instagram.com/${handle}`;
    case "tiktok":
      return `https://tiktok.com/@${handle}`;
    case "twitter":
    case "x":
      return `https://x.com/${handle}`;
    case "youtube":
      return `https://youtube.com/@${handle}`;
    default:
      // Facebook pages and LinkedIn profiles/pages can't be reliably
      // resolved to a public URL from just a handle — leave unclickable.
      return undefined;
  }
}

function buildBaseForm(platform: string, caption: string, scheduledDate?: string): FormData {
  const form = new FormData();
  form.append("user", profileUsername());
  form.append("platform[]", platform);
  form.append("title", caption);
  if (scheduledDate) form.append("scheduled_date", scheduledDate);
  return form;
}

function toResult(data: any, accountId: string): PublishResult {
  const result = data.results?.[accountId];
  const providerRef = data.job_id ? `job_id:${data.job_id}` : data.request_id ? `request_id:${data.request_id}` : undefined;
  return {
    success: result?.success ?? data.success ?? true,
    providerRef,
    url: result?.url,
    error: result?.error,
    scheduled: !!data.job_id,
  };
}

// Legacy provider: kept so posts made before Zernio still show their status.
// Here the account id is the platform name.
export class UploadPostPublisher implements Publisher {
  id = "upload-post";

  async publishPhoto(params: PublishTarget & { imageUrl: string }): Promise<PublishResult> {
    const form = buildBaseForm(params.platform, params.caption, params.scheduledDate);
    form.append("photos[]", params.imageUrl);
    const data = await postForm<any>("/upload_photos", form);
    return toResult(data, params.platform);
  }

  async publishVideo(params: PublishTarget & { videoUrl: string }): Promise<PublishResult> {
    const form = buildBaseForm(params.platform, params.caption, params.scheduledDate);
    form.append("video", params.videoUrl);
    const data = await postForm<any>("/upload", form);
    return toResult(data, params.platform);
  }

  async publishText(params: PublishTarget): Promise<PublishResult> {
    const form = buildBaseForm(params.platform, params.caption, params.scheduledDate);
    const data = await postForm<any>("/upload_text", form);
    return toResult(data, params.platform);
  }

  async getConnectUrl(): Promise<string | null> {
    return "https://app.upload-post.com";
  }

  async getStatus(providerRef: string) {
    const [refType, refValue] = providerRef.includes(":")
      ? [providerRef.slice(0, providerRef.indexOf(":")), providerRef.slice(providerRef.indexOf(":") + 1)]
      : ["request_id", providerRef];

    const data = await get<any>("/uploadposts/status", { [refType]: refValue });
    const status = data.status?.toLowerCase();
    const mapped =
      status === "completed" ? "completed" as const :
      status === "failed" ? "failed" as const :
      ["pending", "queued"].includes(status) ? "pending" as const :
      "processing" as const;

    const firstResult = data.results?.[0];
    return {
      status: mapped,
      url: firstResult?.url,
      error: firstResult?.message,
    };
  }

  async cancelScheduled(providerRef: string): Promise<{ success: boolean }> {
    // Only a scheduled submission (a job_id) is sitting in Upload-Post's
    // schedule queue waiting to fire — a request_id was already submitted
    // for immediate processing and isn't cancellable this way.
    if (!providerRef.startsWith("job_id:")) return { success: true };
    const jobId = providerRef.slice("job_id:".length);
    const data = await del<any>(`/uploadposts/schedule/${encodeURIComponent(jobId)}`);
    return { success: data?.success ?? true };
  }

  async listAccounts(): Promise<ConnectedAccount[]> {
    const username = profileUsername();
    const data = await get<any>(`/uploadposts/users/${encodeURIComponent(username)}`);
    const socialAccounts: Record<string, any> = data?.profile?.social_accounts || {};

    return Object.entries(socialAccounts)
      .filter(([, value]) => !!value && typeof value === "object")
      .map(([platform, value]) => ({
        id: platform,
        platform,
        name: value.display_name || value.handle || username,
        provider: this.id,
        avatarUrl: value.social_images,
        profileUrl: profileUrlFor(platform, value.handle),
      }));
  }
}
