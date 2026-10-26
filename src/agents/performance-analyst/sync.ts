import { inngest } from "@/jobs/client";
import { businessDb } from "@/lib/supabase/business";
import { analyticsFor } from "@/providers/analytics/registry";
import type { PostMetrics } from "@/providers/analytics/types";
import { publisherFor } from "@/providers/publishing/registry";
import { optional } from "@/agents/run";
import { agentStep } from "@/agents/run";
import { cronForEveryBusiness } from "@/jobs/every-business";
import { engagementRate } from "./score";

// Agent 10 · Performance Analyst, daily: metrics for every post in its first 30 days (one row per
// post target per day in post_metrics), and follower counts per account (account_snapshots).

const TRACK_DAYS = 30;
const SINGLE_LOOKUPS = 25;

function row(targetId: string, day: string, m: PostMetrics) {
  const base = {
    impressions: m.impressions,
    reach: m.reach,
    views: m.views,
    likes: m.likes,
    comments: m.comments,
    shares: m.shares,
    saves: m.saves,
    engagement_rate: null as number | null,
  };
  base.engagement_rate = engagementRate({ ...base, engagement_rate: m.engagementRate });
  return { post_target_id: targetId, captured_on: day, ...base, clicks: m.clicks, raw: m.raw as object };
}

/** Every day at 05:00 UTC, for each business */
export const metricsCron = cronForEveryBusiness("agent-performance-metrics-cron", "TZ=UTC 0 5 * * *", "performance/sync");

export const metricsSync = inngest.createFunction(
  { id: "agent-performance-metrics", retries: 2, concurrency: [{ limit: 1, key: "event.data.businessId" }] },
  { event: "performance/sync" },
  async ({ event, step }) => {
    const { businessId } = event.data;
    const day = new Date().toISOString().slice(0, 10);
    const runId = `metrics-${day}`;
    const task = <T,>(id: string, fn: () => Promise<T>, summary: (r: T) => string) => agentStep(step, id, { businessId, agent: "performance_analyst", runId, summary }, () => fn());

    const targets = await task(
      "published-posts",
      async () => {
        const since = new Date(Date.now() - TRACK_DAYS * 86400_000).toISOString();
        const { data, error } = await businessDb(businessId)
          .from("post_targets")
          .select("id, platform, provider, provider_ref, provider_post_id, published_at")
          .eq("status", "published")
          .gte("published_at", since);
        if (error) throw error;
        return (data ?? []).filter((t) => t.provider === "zernio");
      },
      (r) => `Found ${r.length} posts published in the last ${TRACK_DAYS} days`
    );

    if (targets.length) {
      await task(
        "post-metrics",
        async () => {
          const db = businessDb(businessId);
          const analytics = analyticsFor();
          const since = new Date(Date.now() - TRACK_DAYS * 86400_000).toISOString().slice(0, 10);
          // One paged list for everything; a provider post id can be its post or the platform post
          const found = new Map<string, PostMetrics>();
          let page: number | null = 1;
          for (let i = 0; page && i < 20; i++) {
            const res: Awaited<ReturnType<typeof analytics.getMetricsSince>> = await analytics.getMetricsSince(since, page);
            for (const p of res.posts) if (p.providerPostId) found.set(p.providerPostId, p.metrics);
            page = res.nextPage;
          }
          const rows = [];
          let single = 0;
          for (const t of targets) {
            let m = found.get(t.provider_post_id ?? "") ?? found.get(t.provider_ref ?? "");
            const id = t.provider_post_id ?? t.provider_ref;
            if (!m && id && single < SINGLE_LOOKUPS) {
              single++;
              m = (await analytics.getPostMetrics(id).catch(() => null)) ?? undefined;
            }
            if (m) rows.push(row(t.id, day, m));
          }
          if (rows.length) {
            const { error } = await db.from("post_metrics").upsert(rows, { onConflict: "post_target_id,captured_on" });
            if (error) throw error;
          }
          return { saved: rows.length, of: targets.length };
        },
        (r) => `Saved today's numbers for ${r.saved} of ${r.of} posts`
      );
    }

    await optional(
      task(
        "followers",
        async () => {
          const db = businessDb(businessId);
          const accounts = await publisherFor().listAccounts(db);
          const analytics = analyticsFor();
          let saved = 0;
          for (const a of accounts) {
            const stats = await analytics.getAccountStats(a.id).catch(() => null);
            if (!stats || stats.followers === null) continue;
            const { error } = await db
              .from("account_snapshots")
              .upsert({ platform: a.platform, account_id: a.id, captured_on: day, followers: stats.followers, raw: stats.raw as object }, { onConflict: "business_id,platform,account_id,captured_on" });
            if (!error) saved++;
          }
          return saved;
        },
        (n) => `Saved follower counts for ${n} accounts`
      )
    );
    return { day, posts: targets.length };
  }
);
