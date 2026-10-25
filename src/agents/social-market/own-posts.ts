import type { SupabaseClient } from "@supabase/supabase-js";
import { analyticsFor } from "@/providers/analytics/registry";
import type { PastPost } from "@/providers/analytics/types";
import { ai } from "@/providers/ai/registry";
import { handleFromUrl } from "@/providers/social/handles";
import { READABLE_PLATFORMS, type ReadablePlatform, type SocialPost } from "@/providers/social/types";
import type { ConnectedAccount } from "@/providers/publishing/types";
import type { Usage } from "@/providers/usage";
import { saveSource } from "@/agents/research/brain";
import { scorePosts, splitTopBottom, type Baseline, type ScoredPost } from "./baseline";

// The client's own posts: from connected accounts (Zernio, with real metrics) or, when a platform
// isn't connected, from the public profile (ScrapeCreators).

const POSTS_PER_PLATFORM = 50;

/** Where one platform's posts come from. */
export type OwnSource = { platform: string; via: "zernio"; accountId: string; name: string } | { platform: ReadablePlatform; via: "public"; handle: string };

/** Connected accounts first; public profiles only for platforms that aren't connected. */
export function ownSources(accounts: ConnectedAccount[], socials: Record<string, string>): OwnSource[] {
  const connected: OwnSource[] = accounts.map((a) => ({
    platform: a.platform,
    via: "zernio",
    accountId: a.id,
    name: a.name,
  }));
  const connectedPlatforms = new Set(accounts.map((a) => a.platform));
  const publicOnes = READABLE_PLATFORMS.filter((p) => !connectedPlatforms.has(p)).flatMap((platform): OwnSource[] => {
    const handle = handleFromUrl(platform, socials[platform]);
    return handle ? [{ platform, via: "public", handle }] : [];
  });
  return [...connected, ...publicOnes];
}

function fromPastPost(p: PastPost, platform: string): SocialPost {
  const isVideo = /video|reel|short/i.test(p.mediaType ?? "") || p.mediaUrls.some((u) => /\.(mp4|mov|webm)(\?|$)/i.test(u));
  return {
    id: p.providerPostId,
    platform: p.platform ?? platform,
    url: p.url,
    caption: p.content,
    publishedAt: p.publishedAt,
    mediaType: isVideo ? "video" : p.mediaUrls.length > 1 ? "carousel" : "image",
    videoUrl: isVideo ? (p.mediaUrls.find((u) => /\.(mp4|mov|webm)(\?|$)/i.test(u)) ?? p.mediaUrls[0]) : undefined,
    views: p.metrics.views ?? p.metrics.impressions,
    likes: p.metrics.likes,
    comments: p.metrics.comments,
    shares: p.metrics.shares,
    saves: p.metrics.saves,
    engagementRate: p.metrics.engagementRate,
  };
}

/** One platform, measured: baseline plus the posts worth learning from. Kept small (it's a step result). */
export interface PlatformResult {
  platform: string;
  via: OwnSource["via"];
  label: string;
  followers: number | null;
  posts: number;
  baseline: Baseline;
  top: ScoredPost[];
  bottom: ScoredPost[];
}

export async function readOwnPlatform(db: SupabaseClient, source: OwnSource): Promise<{ result: PlatformResult | null; usage: Usage[] }> {
  const usage: Usage[] = [];
  let posts: SocialPost[] = [];
  let followers: number | null = null;
  let profileUrl: string;
  let label: string;

  if (source.via === "zernio") {
    const analytics = analyticsFor();
    const [past, stats] = await Promise.all([
      analytics.listPastPosts(source.accountId, POSTS_PER_PLATFORM),
      analytics.getAccountStats(source.accountId).catch(() => null),
    ]);
    posts = past.map((p) => fromPastPost(p, source.platform));
    followers = stats?.followers ?? null;
    profileUrl = `zernio:${source.accountId}`;
    label = source.name;
  } else {
    const [profile, list] = await Promise.all([
      ai.social.profile(source.platform, source.handle),
      ai.social.posts(source.platform, source.handle, POSTS_PER_PLATFORM),
    ]);
    usage.push(profile.usage, list.usage);
    if (!profile.data && !list.data.length) return { result: null, usage };
    posts = list.data;
    followers = profile.data?.followers ?? null;
    profileUrl = profile.data?.url ?? source.handle;
    label = `@${source.handle}`;
  }

  const { baseline, posts: scored } = scorePosts(source.platform, posts, followers);
  const { top, bottom } = splitTopBottom(scored);

  // Captions go into the Brand Brain: they show how the brand already talks
  const captions = scored.filter((p) => p.caption).map((p) => `- ${p.caption!.replace(/\s+/g, " ")}${p.score !== null ? ` (score ${p.score})` : ""}`);
  if (captions.length) {
    await saveSource(db, {
      kind: "social_post",
      url: profileUrl,
      title: `${source.platform} posts by ${label}`,
      content: captions.join("\n"),
      metadata: {
        platform: source.platform,
        via: source.via,
        followers,
        baseline,
      },
    });
  }

  return {
    result: {
      platform: source.platform,
      via: source.via,
      label,
      followers,
      posts: posts.length,
      baseline,
      top: top.slice(0, 6),
      bottom: bottom.slice(0, 4),
    },
    usage,
  };
}
