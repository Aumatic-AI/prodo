import type { SupabaseClient } from "@supabase/supabase-js";
import { engagementRate, engagements, median } from "@/agents/performance-analyst/score";
import { addDays, safeZone, zonedParts } from "@/lib/zoned-time";

// Everything the Performance screen shows, from post_metrics (latest numbers per post),
// account_snapshots, learnings and the latest weekly report.

export interface PerfTotals {
  posts: number;
  reach: number;
  views: number;
  engagements: number;
  clicks: number;
  /** Average engagement rate (fraction) */
  er: number | null;
}

export interface PerformanceView {
  days: number;
  timezone: string;
  totals: PerfTotals;
  previous: PerfTotals;
  followers: { total: number | null; change: number | null; series: { date: string; total: number }[]; accounts: { platform: string; accountId: string; followers: number }[] };
  daily: { date: string; posts: number; reach: number; engagements: number }[];
  platforms: { platform: string; posts: number; reach: number; engagements: number; er: number | null }[];
  topPosts: {
    postId: string;
    platform: string;
    caption: string;
    url: string | null;
    publishedAt: string;
    media: { type: string; storage_key: string | null } | null;
    reach: number | null;
    views: number | null;
    engagements: number;
    er: number | null;
    origin: string;
  }[];
  learnings: { dimension: string; value: string; label: string; score: number; sample: number; confidence: number; insight: string | null }[];
  report: { week_start: string; headline: string; summary: string; next_week: string[]; created_at: string } | null;
  /** Agent posts approved vs skipped in the period */
  approvals: { approved: number; rejected: number };
  hasData: boolean;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));

function totals(rows: { reach: number | null; views: number | null; engagements: number; clicks: number | null; er: number | null }[]): PerfTotals {
  const ers = rows.map((r) => r.er).filter((v): v is number => v !== null);
  return {
    posts: rows.length,
    reach: rows.reduce((s, r) => s + (r.reach ?? 0), 0),
    views: rows.reduce((s, r) => s + (r.views ?? 0), 0),
    engagements: rows.reduce((s, r) => s + r.engagements, 0),
    clicks: rows.reduce((s, r) => s + (r.clicks ?? 0), 0),
    er: ers.length ? ers.reduce((a, b) => a + b, 0) / ers.length : null,
  };
}

export async function loadPerformanceView(db: SupabaseClient, days: number): Promise<PerformanceView> {
  const { data: profile } = await db.from("business_profile").select("timezone").eq("id", 1).single();
  const tz = safeZone(profile?.timezone);
  const now = Date.now();
  const start = new Date(now - days * 86400_000).toISOString();
  const prevStart = new Date(now - 2 * days * 86400_000).toISOString();

  const [targets, snapshots, learnings, report, feedback, pillars, personas] = await Promise.all([
    db
      .from("post_targets")
      .select("id, platform, caption, url, published_at, post:posts!inner(id, origin, media:media(type, storage_key)), post_metrics(captured_on, impressions, reach, views, likes, comments, shares, saves, clicks, engagement_rate)")
      .eq("status", "published")
      .gte("published_at", prevStart),
    db.from("account_snapshots").select("platform, account_id, captured_on, followers").gte("captured_on", addDays(start.slice(0, 10), -1)).order("captured_on"),
    db.from("learnings").select("dimension, value, platform, score, sample_size, confidence, insight").is("platform", null).neq("dimension", "baseline").gte("sample_size", 3),
    db.from("weekly_reports").select("week_start, headline, summary, next_week, created_at").order("week_start", { ascending: false }).limit(1).maybeSingle(),
    db.from("feedback").select("action").in("action", ["approve", "reject"]).gte("created_at", start),
    db.from("content_pillars").select("id, name"),
    db.from("personas").select("id, name"),
  ]);
  if (targets.error) throw targets.error;

  const rows = (targets.data ?? []).map((t: any) => {
    const m = [...(t.post_metrics ?? [])].sort((a, b) => String(b.captured_on).localeCompare(String(a.captured_on)))[0] ?? null;
    const post = one(t.post) as { id: string; origin: string; media: unknown } | null;
    return {
      postId: post?.id ?? "",
      origin: post?.origin ?? "manual",
      media: one(post?.media as never) as { type: string; storage_key: string | null } | null,
      platform: t.platform as string,
      caption: (t.caption ?? "") as string,
      url: t.url as string | null,
      publishedAt: t.published_at as string,
      reach: m ? (m.reach ?? m.impressions ?? null) : null,
      views: m?.views ?? null,
      clicks: m?.clicks ?? null,
      engagements: m ? engagements(m) : 0,
      er: m ? engagementRate(m) : null,
    };
  });
  const current = rows.filter((r) => r.publishedAt >= start);
  const previous = rows.filter((r) => r.publishedAt < start);

  // Per day of publishing, in the client's time zone
  const dayOf = (iso: string) => zonedParts(new Date(iso), tz).day;
  const firstDay = dayOf(start);
  const daily = Array.from({ length: days }, (_, i) => addDays(firstDay, i + 1)).map((date) => {
    const on = current.filter((r) => dayOf(r.publishedAt) === date);
    return { date, posts: on.length, reach: on.reduce((s, r) => s + (r.reach ?? 0), 0), engagements: on.reduce((s, r) => s + r.engagements, 0) };
  });

  const platforms = [...new Set(current.map((r) => r.platform))].map((platform) => {
    const on = current.filter((r) => r.platform === platform);
    const t = totals(on);
    return { platform, posts: on.length, reach: t.reach, engagements: t.engagements, er: t.er };
  });

  // Score inside the period: engagement rate against the period's own median per platform
  const medians = new Map(platforms.map((p) => [p.platform, median(current.filter((r) => r.platform === p.platform && r.er !== null).map((r) => r.er!))]));
  const topPosts = [...current]
    .filter((r) => r.er !== null || r.reach !== null)
    .sort((a, b) => (b.er ?? 0) / (medians.get(b.platform) || 1) - (a.er ?? 0) / (medians.get(a.platform) || 1) || (b.reach ?? 0) - (a.reach ?? 0))
    .slice(0, 6)
    .map(({ postId, platform, caption, url, publishedAt, media, reach, views, engagements: e, er, origin }) => ({ postId, platform, caption: caption.slice(0, 220), url, publishedAt, media, reach, views, engagements: e, er, origin }));

  // Followers: latest per account, change from the first day in the period
  const snaps = snapshots.data ?? [];
  const latest = new Map<string, { platform: string; followers: number }>();
  const first = new Map<string, number>();
  const byDay = new Map<string, Map<string, number>>();
  for (const s of snaps) {
    if (s.followers === null) continue;
    if (!first.has(s.account_id)) first.set(s.account_id, s.followers);
    latest.set(s.account_id, { platform: s.platform, followers: s.followers });
    const m = byDay.get(s.captured_on) ?? new Map<string, number>();
    m.set(s.account_id, s.followers);
    byDay.set(s.captured_on, m);
  }
  const total = latest.size ? [...latest.values()].reduce((a, b) => a + b.followers, 0) : null;
  const startTotal = first.size ? [...first.values()].reduce((a, b) => a + b, 0) : null;

  const names = new Map([...(pillars.data ?? []), ...(personas.data ?? [])].map((r) => [r.id, r.name]));
  const fb = feedback.data ?? [];

  return {
    days,
    timezone: tz,
    totals: totals(current),
    previous: totals(previous),
    followers: {
      total,
      change: total !== null && startTotal !== null ? total - startTotal : null,
      series: [...byDay.entries()].map(([date, m]) => ({ date, total: [...m.values()].reduce((a, b) => a + b, 0) })),
      accounts: [...latest.entries()].map(([accountId, v]) => ({ accountId, platform: v.platform, followers: v.followers })),
    },
    daily,
    platforms,
    topPosts,
    learnings: (learnings.data ?? [])
      .map((l) => ({
        dimension: l.dimension,
        value: l.value,
        label: names.get(l.value) ?? l.value,
        score: Number(l.score),
        sample: l.sample_size,
        confidence: Number(l.confidence ?? 0),
        insight: l.insight,
      }))
      .sort((a, b) => Math.abs(b.score - 1) * b.confidence - Math.abs(a.score - 1) * a.confidence)
      .slice(0, 12),
    report: report.data ?? null,
    approvals: { approved: fb.filter((f) => f.action === "approve").length, rejected: fb.filter((f) => f.action === "reject").length },
    hasData: rows.length > 0 || snaps.length > 0,
  };
}
