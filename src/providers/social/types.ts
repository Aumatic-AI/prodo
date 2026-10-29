/** Platforms we can read public data from without the client connecting them. */
export const READABLE_PLATFORMS = ["instagram", "tiktok", "youtube"] as const;
export type ReadablePlatform = (typeof READABLE_PLATFORMS)[number];

export interface SocialProfile {
  platform: string;
  handle: string;
  name?: string;
  bio?: string;
  followers: number | null;
  url: string;
}

export interface SocialPost {
  id: string;
  platform: string;
  url?: string;
  caption?: string;
  publishedAt?: string;
  mediaType: "video" | "image" | "carousel";
  /** Direct video file, when the platform exposes one (needed for video analysis) */
  videoUrl?: string;
  /** Main image or video cover */
  imageUrl?: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  /** From the provider when it has one; otherwise worked out from the counts */
  engagementRate?: number | null;
}

export interface AdCreative {
  network: "meta" | "google";
  id: string;
  advertiser?: string;
  text?: string;
  title?: string;
  cta?: string;
  format?: string;
  firstShown?: string;
  lastShown?: string;
  url?: string;
  /** The ad's video file, when it is a video ad (Meta) */
  videoUrl?: string;
  /** The ad's main image (Meta) */
  imageUrl?: string;
}

export interface WebResult {
  url: string;
  title: string;
  description?: string;
}

export interface AdvertiserMatch {
  pageId: string;
  name: string;
  instagram?: string;
  likes: number | null;
}
