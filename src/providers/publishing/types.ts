import type { SupabaseClient } from "@supabase/supabase-js";

export interface PublishResult {
  success: boolean;
  /** Provider's id for this submission, used for status and cancel */
  providerRef?: string;
  url?: string;
  error?: string;
  /** Queued for a future time, not live yet */
  scheduled?: boolean;
}

export interface PublishTarget {
  platform: string;
  accountId: string;
  caption: string;
  /** ISO time for a scheduled post; omit to publish now */
  scheduledDate?: string;
}

export interface PublishStatus {
  status: "pending" | "processing" | "completed" | "failed";
  url?: string;
  error?: string;
  /** Provider's post id, used later to fetch metrics */
  providerPostId?: string;
  publishedAt?: string;
}

export interface ConnectedAccount {
  id: string;
  platform: string;
  name: string;
  provider: string;
  profileUrl?: string;
  avatarUrl?: string;
}

export interface Publisher {
  id: string;
  publishPhoto(params: PublishTarget & { imageUrl: string }): Promise<PublishResult>;
  publishVideo(params: PublishTarget & { videoUrl: string }): Promise<PublishResult>;
  publishText(params: PublishTarget): Promise<PublishResult>;
  /** Several images as one post. Not every provider supports it. */
  publishCarousel?(params: PublishTarget & { imageUrls: string[] }): Promise<PublishResult>;
  getStatus(providerRef: string, platform: string): Promise<PublishStatus>;
  /** Cancels a still-scheduled submission. Succeeds if there is nothing to cancel. */
  cancelScheduled(providerRef: string): Promise<{ success: boolean }>;
  /** The business's connected accounts. `db` is limited to that business (RLS or businessDb). */
  listAccounts(db: SupabaseClient): Promise<ConnectedAccount[]>;
  /** Link where the client signs in to connect an account, or null if done on the provider's site */
  getConnectUrl(db: SupabaseClient, platform: string): Promise<string | null>;
}
