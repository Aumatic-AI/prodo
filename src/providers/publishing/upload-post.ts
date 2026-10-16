import type { Publisher, PublishResult } from "./types";
import { AppError } from "@/core/errors";

const BASE_URL = "https://app.upload-post.com/api";

function headers() {
  const key = process.env.UPLOAD_POST_API_KEY;
  if (!key) throw new AppError("Upload-Post API key not configured", "PROVIDER_DOWN", false);
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers: headers() });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    const msg = body?.message || body?.error || `Upload-Post error (${res.status})`;
    if (res.status === 429) {
      throw new AppError("Upload-Post rate limit — try again shortly", "RATE_LIMITED", true, 30_000);
    }
    if (res.status === 401 || res.status === 403) {
      throw new AppError("Upload-Post account disconnected or key invalid", "ACCOUNT_DISCONNECTED", false);
    }
    throw new AppError(msg, "PROVIDER_DOWN", res.status >= 500);
  }

  return body;
}

export class UploadPostPublisher implements Publisher {
  async publishPhoto(params: {
    imageUrl: string;
    caption: string;
    accountId: string;
  }): Promise<PublishResult> {
    const data = await request<any>("/upload/photos", {
      method: "POST",
      body: JSON.stringify({
        profile_id: params.accountId,
        media_url: params.imageUrl,
        caption: params.caption,
      }),
    });
    return { success: true, providerRef: data.id };
  }

  async publishVideo(params: {
    videoUrl: string;
    caption: string;
    accountId: string;
  }): Promise<PublishResult> {
    const data = await request<any>("/upload/video", {
      method: "POST",
      body: JSON.stringify({
        profile_id: params.accountId,
        media_url: params.videoUrl,
        caption: params.caption,
      }),
    });
    return { success: true, providerRef: data.id };
  }

  async publishText(params: {
    caption: string;
    accountId: string;
  }): Promise<PublishResult> {
    const data = await request<any>("/upload/text", {
      method: "POST",
      body: JSON.stringify({
        profile_id: params.accountId,
        caption: params.caption,
      }),
    });
    return { success: true, providerRef: data.id };
  }

  async getStatus(providerRef: string) {
    const data = await request<any>(`/upload/status/${providerRef}`);
    const status = data.status?.toLowerCase();
    const mapped =
      status === "completed" ? "completed" as const :
      status === "failed" ? "failed" as const :
      ["pending", "queued"].includes(status) ? "pending" as const :
      "processing" as const;
    return {
      status: mapped,
      url: data.url,
      error: data.error,
    };
  }

  async listAccounts() {
    const raw = await request<any>("/profiles");
    const data = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];
    return data.map((p: any) => ({
      id: String(p.id),
      platform: p.platform?.toLowerCase() || "unknown",
      name: p.username || p.name || "Unknown",
      profileUrl: p.profile_url,
      avatarUrl: p.avatar_url,
    }));
  }

  async getConnectUrl() {
    const data = await request<{ url: string }>("/profiles/connect");
    return data.url;
  }
}
