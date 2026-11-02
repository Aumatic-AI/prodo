// Agent 10's maths (code only): engagement rate, baselines, each post's score against the
// account's average, and learnings grouped by angle, hook, format, framework, lever, pillar,
// persona and posting time. Pure functions, checked offline.

export const MIN_POSTS_FOR_BASELINE = 10;
/** Nothing is called a confident learning below this many posts (knowledge base §11.3: under 5 low, 5–14 medium, 15+ high) */
export const MIN_CONFIDENT = 5;
export const HIGH_CONFIDENT = 15;
/** A post at this many times the account's usual, within a day of publishing, is a breakout (§7.2) */
export const BREAKOUT = 2;
/** A winning angle or hook scoring under this twice in a row is tired and rests 3–4 weeks (§11.3) */
export const FATIGUE = 0.8;
/** A rejected post counts like a weak post, at half weight */
export const REJECTED_SCORE = 0.6;
export const REJECTED_WEIGHT = 0.5;

/** Typical engagement rates per platform, used until the account has 10+ posts there. */
export const DEFAULT_ER: Record<string, number> = {
  instagram: 0.012,
  facebook: 0.006,
  linkedin: 0.02,
  tiktok: 0.04,
  twitter: 0.005,
  youtube: 0.03,
};

export interface MetricsLike {
  impressions: number | null;
  reach: number | null;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  engagement_rate: number | null;
}

export function engagements(m: MetricsLike): number {
  return (m.likes ?? 0) + (m.comments ?? 0) + (m.shares ?? 0) + (m.saves ?? 0);
}

/** The provider's rate when it gives one (as a fraction), else engagements ÷ reach (or impressions, views). */
export function engagementRate(m: MetricsLike): number | null {
  if (m.engagement_rate !== null && m.engagement_rate !== undefined) {
    // Some providers send percentages
    return m.engagement_rate > 1 ? m.engagement_rate / 100 : m.engagement_rate;
  }
  const base = m.reach || m.impressions || m.views;
  return base ? engagements(m) / base : null;
}

export function median(values: number[]): number | null {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export interface ScoredPost {
  targetId: string;
  platform: string;
  er: number | null;
  views: number | null;
  /** 1.0 = the account's average on that platform */
  score: number | null;
}

export interface Baseline {
  er: number;
  views: number | null;
  sample: number;
  /** Where the number came from */
  from: "own" | "research" | "default";
}

/** Per platform: the median of own posts when there are enough, else the research baseline, else a default. */
export function baselines(
  posts: { platform: string; er: number | null; views: number | null }[],
  stored: Record<string, { er?: number; views?: number }>
): Record<string, Baseline> {
  const platforms = [...new Set([...posts.map((p) => p.platform), ...Object.keys(stored)])];
  const out: Record<string, Baseline> = {};
  for (const platform of platforms) {
    const own = posts.filter((p) => p.platform === platform);
    const ers = own.map((p) => p.er).filter((v): v is number => v !== null);
    const views = own.map((p) => p.views).filter((v): v is number => v !== null && v > 0);
    if (ers.length >= MIN_POSTS_FOR_BASELINE) {
      out[platform] = { er: median(ers)!, views: median(views), sample: ers.length, from: "own" };
    } else if (stored[platform]?.er) {
      out[platform] = { er: stored[platform].er!, views: stored[platform].views ?? median(views), sample: ers.length, from: "research" };
    } else {
      out[platform] = { er: DEFAULT_ER[platform] ?? 0.015, views: median(views), sample: ers.length, from: "default" };
    }
  }
  return out;
}

/** Score = engagement rate ÷ baseline (views ÷ baseline views when there is no rate), capped at 5. */
export function scorePost(er: number | null, views: number | null, base: Baseline | undefined): number | null {
  if (!base) return null;
  if (er !== null && base.er > 0) return Math.min(5, Math.round((er / base.er) * 100) / 100);
  if (views !== null && base.views) return Math.min(5, Math.round((views / base.views) * 100) / 100);
  return null;
}

export interface Tagged {
  score: number;
  weight: number;
  platform: string;
  tags: { dimension: Dimension; value: string }[];
}

export type Dimension =
  | "angle"
  | "hook_type"
  | "format"
  | "style"
  | "framework"
  | "lever"
  | "pillar"
  | "persona"
  | "time_slot"
  | "ad_objective"
  | "desire"
  | "awareness_level"
  | "style_modifier";

export interface Learning {
  dimension: Dimension;
  value: string;
  platform: string | null;
  sample_size: number;
  score: number;
  confidence: number;
}

/** More posts = more confidence: 5 posts ≈ 0.5, 10 ≈ 0.67, 20 ≈ 0.8. */
export function confidence(n: number): number {
  return Math.round((n / (n + 5)) * 100) / 100;
}

export type ConfidenceLabel = "low" | "medium" | "high";
export const confidenceLabel = (n: number): ConfidenceLabel => (n >= HIGH_CONFIDENT ? "high" : n >= MIN_CONFIDENT ? "medium" : "low");

/** Extreme scores from few posts move toward 1.0 (average): full weight only from 15 posts. */
export function shrink(score: number, n: number): number {
  return 1 + (score - 1) * Math.min(1, n / HIGH_CONFIDENT);
}

/**
 * Values (per dimension) whose last two uses both scored under FATIGUE, after having done well before:
 * they rest for a few weeks and their winning parts get remixed. `posts` come in any order.
 */
export function fatigued(posts: { publishedAt: string; score: number; tags: { dimension: Dimension; value: string }[] }[], dimensions: Dimension[] = ["angle", "hook_type", "framework"]): { dimension: Dimension; value: string }[] {
  const uses = new Map<string, { dimension: Dimension; value: string; scores: number[] }>();
  for (const p of [...posts].sort((a, b) => a.publishedAt.localeCompare(b.publishedAt))) {
    for (const t of p.tags) {
      if (!dimensions.includes(t.dimension)) continue;
      const key = `${t.dimension}|${t.value}`;
      const u = uses.get(key) ?? { dimension: t.dimension, value: t.value, scores: [] };
      u.scores.push(p.score);
      uses.set(key, u);
    }
  }
  return [...uses.values()]
    .filter((u) => u.scores.length >= 3 && u.scores.slice(-2).every((x) => x < FATIGUE) && Math.max(...u.scores.slice(0, -2)) >= 1)
    .map(({ dimension, value }) => ({ dimension, value }));
}

/** Weighted mean score per dimension value, across all platforms and per platform. */
export function groupLearnings(items: Tagged[]): Learning[] {
  const groups = new Map<string, { dimension: Dimension; value: string; platform: string | null; sum: number; weight: number; n: number }>();
  for (const item of items) {
    for (const tag of item.tags) {
      for (const platform of [null, item.platform]) {
        const key = `${tag.dimension}|${tag.value}|${platform ?? ""}`;
        const g = groups.get(key) ?? { dimension: tag.dimension, value: tag.value, platform, sum: 0, weight: 0, n: 0 };
        g.sum += item.score * item.weight;
        g.weight += item.weight;
        g.n += 1;
        groups.set(key, g);
      }
    }
  }
  return [...groups.values()]
    .filter((g) => g.weight > 0)
    .map((g) => ({
      dimension: g.dimension,
      value: g.value,
      platform: g.platform,
      sample_size: g.n,
      score: Math.round(shrink(g.sum / g.weight, g.n) * 100) / 100,
      confidence: confidence(g.n),
    }));
}

/** "HH:00" of an instant in the client's time zone: the time_slot learning value. */
export function hourSlot(iso: string, tz: string): string {
  const hour = new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date(iso));
  return `${hour.padStart(2, "0")}:00`;
}
