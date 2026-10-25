import type { SupabaseClient } from "@supabase/supabase-js";
import type { SocialPost } from "@/providers/social/types";

// What "normal" looks like on each platform, so later posts can be scored against it
// (1.0 = an average post for this account). Pure maths, no AI.

/** Fewer posts than this and the baseline falls back to platform defaults with low confidence. */
export const MIN_POSTS = 10;

/** Rough typical engagement per view, used only when there's too little history. */
const DEFAULT_ENGAGEMENT: Record<string, number> = {
  instagram: 0.03,
  tiktok: 0.04,
  youtube: 0.03,
  facebook: 0.01,
  linkedin: 0.02,
  twitter: 0.01,
};

export interface ScoredPost {
  id: string;
  url?: string;
  caption?: string;
  mediaType: SocialPost["mediaType"];
  videoUrl?: string;
  views: number | null;
  engagementRate: number | null;
  /** engagementRate / the account's median (1.0 = average) */
  score: number | null;
}

export interface Baseline {
  platform: string;
  sampleSize: number;
  /** Interactions per view (or per follower when views are missing) */
  medianEngagement: number;
  medianViews: number | null;
  /** 0–1. Below MIN_POSTS it's a platform default at 0.2 */
  confidence: number;
  per: "view" | "follower";
  /** Median score per format vs. the baseline, e.g. { video: 1.4, image: 0.8 } */
  byFormat: Record<string, { score: number; posts: number }>;
}

export function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

const interactions = (p: SocialPost) => (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0);

/**
 * Scores every post and works out the baseline. Engagement is per view when most posts have
 * view counts, otherwise per follower; one platform always uses one of the two.
 */
export function scorePosts(platform: string, posts: SocialPost[], followers: number | null): { baseline: Baseline; posts: ScoredPost[] } {
  const withViews = posts.filter((p) => (p.views ?? 0) > 0).length;
  const per: Baseline["per"] = withViews >= posts.length / 2 || !followers ? "view" : "follower";

  const rateOf = (p: SocialPost): number | null => {
    if (p.engagementRate != null) return p.engagementRate > 1 ? p.engagementRate / 100 : p.engagementRate;
    const base = per === "view" ? p.views : followers;
    return base && base > 0 ? interactions(p) / base : null;
  };

  const rated = posts.map((p) => ({ post: p, rate: rateOf(p) }));
  const rates = rated.map((r) => r.rate).filter((r): r is number => r !== null);
  const enough = rates.length >= MIN_POSTS;
  const medianEngagement = (enough ? median(rates) : null) ?? DEFAULT_ENGAGEMENT[platform] ?? 0.02;
  const medianViews = median(posts.map((p) => p.views).filter((v): v is number => v !== null && v > 0));

  const scored: ScoredPost[] = rated.map(({ post, rate }) => ({
    id: post.id,
    url: post.url,
    caption: post.caption?.slice(0, 400),
    mediaType: post.mediaType,
    videoUrl: post.videoUrl,
    views: post.views,
    engagementRate: rate,
    score: rate !== null && medianEngagement > 0 ? Math.round((rate / medianEngagement) * 100) / 100 : null,
  }));

  const byFormat: Baseline["byFormat"] = {};
  for (const format of ["video", "image", "carousel"] as const) {
    const scores = scored.filter((p) => p.mediaType === format && p.score !== null).map((p) => p.score!);
    const m = median(scores);
    if (m !== null)
      byFormat[format] = {
        score: Math.round(m * 100) / 100,
        posts: scores.length,
      };
  }

  return {
    baseline: {
      platform,
      sampleSize: rates.length,
      medianEngagement,
      medianViews,
      confidence: enough ? Math.min(1, 0.5 + rates.length / 60) : 0.2,
      per,
      byFormat,
    },
    posts: scored,
  };
}

/** Top and bottom 20% by score (at least one each when there are scores). */
export function splitTopBottom(posts: ScoredPost[]): {
  top: ScoredPost[];
  bottom: ScoredPost[];
} {
  const ranked = posts.filter((p) => p.score !== null).sort((a, b) => b.score! - a.score!);
  const n = Math.max(1, Math.round(ranked.length * 0.2));
  if (ranked.length < 2) return { top: ranked, bottom: [] };
  return { top: ranked.slice(0, n), bottom: ranked.slice(-n).reverse() };
}

/** Writes the baselines and per-format scores into learnings (one row per platform and value). */
export async function saveBaselines(db: SupabaseClient, baselines: Baseline[]): Promise<number> {
  const now = new Date().toISOString();
  const rows = baselines.flatMap((b) => {
    const low = b.sampleSize < MIN_POSTS;
    const note = low ? `Platform default: only ${b.sampleSize} posts with numbers` : `Median of the last ${b.sampleSize} posts`;
    return [
      {
        dimension: "baseline",
        value: "engagement_rate",
        platform: b.platform,
        sample_size: b.sampleSize,
        score: b.medianEngagement,
        confidence: b.confidence,
        insight: `${note}, engagement per ${b.per}`,
        updated_at: now,
      },
      ...(b.medianViews !== null
        ? [
            {
              dimension: "baseline",
              value: "views",
              platform: b.platform,
              sample_size: b.sampleSize,
              score: b.medianViews,
              confidence: b.confidence,
              insight: note,
              updated_at: now,
            },
          ]
        : []),
      ...(low
        ? []
        : Object.entries(b.byFormat).map(([format, f]) => ({
            dimension: "format",
            value: format,
            platform: b.platform,
            sample_size: f.posts,
            score: f.score,
            confidence: Math.min(0.6, f.posts / 20),
            insight: `${format} posts score ${f.score}× this account's average on ${b.platform}`,
            updated_at: now,
          }))),
    ];
  });
  if (!rows.length) return 0;
  const { error } = await db.from("learnings").upsert(rows, { onConflict: "dimension,value,platform" });
  if (error) throw error;
  return rows.length;
}
