import { zernioCall } from "@/providers/publishing/zernio";
import type { Analytics, PastPost, PostMetrics } from "./types";

const PAGE_SIZE = 100;

function num(value: unknown): number | null {
  return typeof value === "number" ? value : null;
}

function toMetrics(a: any): PostMetrics {
  return {
    impressions: num(a?.impressions),
    reach: num(a?.reach),
    views: num(a?.views),
    likes: num(a?.likes),
    comments: num(a?.comments),
    shares: num(a?.shares),
    saves: num(a?.saves),
    clicks: num(a?.clicks),
    engagementRate: num(a?.engagementRate),
    raw: a ?? null,
  };
}

function toPastPost(p: any): PastPost {
  return {
    providerPostId: p.postId ?? p._id,
    platform: p.platform ?? p.platformAnalytics?.[0]?.platform,
    content: p.content,
    publishedAt: p.publishedAt,
    url: p.platformPostUrl,
    mediaType: p.mediaType,
    mediaUrls: (p.mediaItems ?? []).map((m: any) => m.url).filter(Boolean),
    metrics: toMetrics(p.analytics),
  };
}

function listOf(body: any): any[] {
  return body.posts ?? body.data ?? body.analytics ?? [];
}

export class ZernioAnalytics implements Analytics {
  async getPostMetrics(providerPostId: string): Promise<PostMetrics | null> {
    const { status, body } = await zernioCall(`/analytics?postId=${encodeURIComponent(providerPostId)}`);
    if (status === 202) return null;
    return toMetrics(body.analytics);
  }

  async getMetricsSince(since: string, page = 1) {
    const qs = new URLSearchParams({ fromDate: since, limit: String(PAGE_SIZE), page: String(page) });
    const { body } = await zernioCall(`/analytics?${qs}`);
    const posts = listOf(body).map(toPastPost);
    return { posts, nextPage: posts.length === PAGE_SIZE ? page + 1 : null };
  }

  async getAccountStats(accountId: string) {
    const { body } = await zernioCall(`/accounts/follower-stats?accountId=${encodeURIComponent(accountId)}`);
    const stats = body.stats?.[0] ?? body.accounts?.[0] ?? body;
    return { followers: num(stats?.followers ?? stats?.followerCount), raw: body };
  }

  async listPastPosts(accountId: string, limit: number) {
    const qs = new URLSearchParams({ accountId, limit: String(Math.min(limit, PAGE_SIZE)), sortBy: "date" });
    const { body } = await zernioCall(`/analytics?${qs}`);
    return listOf(body).map(toPastPost);
  }
}
