export interface PostMetrics {
  impressions: number | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  clicks: number | null;
  engagementRate: number | null;
  raw: unknown;
}

export interface PastPost {
  providerPostId: string;
  platform?: string;
  content?: string;
  publishedAt?: string;
  url?: string;
  mediaType?: string;
  /** Public media URLs, when the provider returns them (needed for video analysis) */
  mediaUrls: string[];
  metrics: PostMetrics;
}

export interface Analytics {
  /** Null while the provider is still syncing the numbers */
  getPostMetrics(providerPostId: string): Promise<PostMetrics | null>;
  /** Posts with metrics published on or after `since` (YYYY-MM-DD) */
  getMetricsSince(since: string, page?: number): Promise<{ posts: PastPost[]; nextPage: number | null }>;
  getAccountStats(accountId: string): Promise<{ followers: number | null; raw: unknown }>;
  listPastPosts(accountId: string, limit: number): Promise<PastPost[]>;
}
