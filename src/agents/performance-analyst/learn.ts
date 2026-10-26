import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/jobs/client";
import { MODELS } from "@/config/models";
import { notify } from "@/core/notifications/notify";
import { businessDb } from "@/lib/supabase/business";
import { addDays, safeZone, weekStartOf, zonedParts } from "@/lib/zoned-time";
import { ai } from "@/providers/ai/registry";
import { urlFor } from "@/providers/storage/supabase-storage";
import { INSIGHTS_SYSTEM, insightsSchema } from "@/prompts/agents/insights";
import { agentStep, optional } from "@/agents/run";
import { cronForEveryBusiness } from "@/jobs/every-business";
import { loadPerformance, loadRejected, storedBaselines, type PerfPost } from "./data";
import { baselines, groupLearnings, MIN_CONFIDENT, REJECTED_SCORE, REJECTED_WEIGHT, scorePost, type Learning, type Tagged } from "./score";

// Agent 10 · Performance Analyst, weekly (Sunday early morning, before the Planner):
// score every post of the last 90 days against the account's baseline (code) → learnings by
// angle, hook type, format, framework, lever, pillar, persona and posting time, with client
// rejections counted too (code) → hook scores and own winning hooks (code) → why the best and
// worst videos did what they did (Twelve Labs, optional) → plain-English insights and the weekly
// report (AI) → report emailed. The Planner reads the learnings on its next run.

const WINDOW_DAYS = 90;
const WINNER = 1.5;

const DIMENSION_NAMES: Record<string, string> = {
  angle: "Angle",
  hook_type: "Hook type",
  format: "Format",
  framework: "Framework",
  lever: "Lever",
  pillar: "Pillar",
  persona: "Persona",
  time_slot: "Posting time",
};

interface WeekStats {
  posts: number;
  reach: number;
  engagements: number;
  er: number | null;
  prevPosts: number;
  prevEr: number | null;
  best: { postId: string; platform: string; score: number; caption: string; url: string | null } | null;
  followers: number | null;
  followersChange: number | null;
}

const avg = (v: number[]) => (v.length ? v.reduce((a, b) => a + b, 0) / v.length : null);

function weekStats(scored: (PerfPost & { score: number | null })[], since: string, prevSince: string): Omit<WeekStats, "followers" | "followersChange"> {
  const week = scored.filter((p) => p.publishedAt >= since);
  const prev = scored.filter((p) => p.publishedAt >= prevSince && p.publishedAt < since);
  const best = [...week].filter((p) => p.score !== null).sort((a, b) => b.score! - a.score!)[0];
  return {
    posts: week.length,
    reach: week.reduce((s, p) => s + (p.reach ?? 0), 0),
    engagements: week.reduce((s, p) => s + p.engagements, 0),
    er: avg(week.map((p) => p.er).filter((v): v is number => v !== null)),
    prevPosts: prev.length,
    prevEr: avg(prev.map((p) => p.er).filter((v): v is number => v !== null)),
    best: best ? { postId: best.postId, platform: best.platform, score: best.score!, caption: best.caption.slice(0, 160), url: best.url } : null,
  };
}

async function followers(db: SupabaseClient, today: string): Promise<{ now: number | null; change: number | null }> {
  const { data } = await db.from("account_snapshots").select("account_id, captured_on, followers").gte("captured_on", addDays(today, -8)).order("captured_on");
  if (!data?.length) return { now: null, change: null };
  const latest = new Map<string, number>();
  const first = new Map<string, number>();
  for (const row of data) {
    if (row.followers === null) continue;
    if (!first.has(row.account_id)) first.set(row.account_id, row.followers);
    latest.set(row.account_id, row.followers);
  }
  const now = [...latest.values()].reduce((a, b) => a + b, 0);
  const then = [...first.values()].reduce((a, b) => a + b, 0);
  return { now, change: now - then };
}

/** Sundays at 02:00 UTC, for each business (before its Planner runs) */
export const learningsCron = cronForEveryBusiness("agent-performance-learnings-cron", "TZ=UTC 0 2 * * 0", "performance/learn");

export const weeklyLearnings = inngest.createFunction(
  { id: "agent-performance-learnings", retries: 2, concurrency: [{ limit: 1, key: "event.data.businessId" }] },
  { event: "performance/learn" },
  async ({ event, step }) => {
    const { businessId } = event.data;
    const db = () => businessDb(businessId);
    const runId = `learnings-${new Date().toISOString().slice(0, 10)}`;
    const task = <T,>(id: string, fn: (track: (u: any) => void) => Promise<T>, summary: (r: T) => string) =>
      agentStep(step, id, { businessId, agent: "performance_analyst", runId, summary }, fn);

    const result = await task(
      "score-posts",
      async () => {
        const { data: profile } = await db().from("business_profile").select("timezone, language, name").single();
        const tz = safeZone(profile?.timezone);
        const sinceIso = new Date(Date.now() - WINDOW_DAYS * 86400_000).toISOString();
        const [posts, rejected, stored] = await Promise.all([loadPerformance(db(), sinceIso, tz), loadRejected(db(), sinceIso, tz), storedBaselines(db())]);

        const base = baselines(posts, stored);
        const scored = posts.map((p) => ({ ...p, score: scorePost(p.er, p.views, base[p.platform]) }));
        const tagged: Tagged[] = [
          ...scored.filter((p) => p.score !== null).map((p) => ({ score: p.score!, weight: 1, platform: p.platform, tags: p.tags })),
          ...rejected.map((r) => ({ score: REJECTED_SCORE, weight: REJECTED_WEIGHT, platform: r.platform, tags: r.tags })),
        ];
        const learnings = groupLearnings(tagged);

        // Save learnings (insights come later) and the account's own baselines
        if (learnings.length) {
          const { error } = await db()
            .from("learnings")
            .upsert(
              learnings.map((l) => ({ ...l, updated_at: new Date().toISOString() })),
              { onConflict: "business_id,dimension,value,platform" }
            );
          if (error) throw error;
        }
        const own = Object.entries(base).filter(([, b]) => b.from === "own");
        for (const [platform, b] of own) {
          await db()
            .from("learnings")
            .upsert(
              [
                { dimension: "baseline", value: "engagement_rate", platform, score: b.er, sample_size: b.sample, confidence: 1, insight: "Median engagement rate of your own posts" },
                ...(b.views ? [{ dimension: "baseline", value: "views", platform, score: b.views, sample_size: b.sample, confidence: 1, insight: "Median views of your own posts" }] : []),
              ],
              { onConflict: "business_id,dimension,value,platform" }
            );
        }

        // Hooks: each used hook gets its post's score; strong ones become own winners
        let winners = 0;
        for (const p of scored) {
          if (!p.planItemId || p.score === null) continue;
          await db().from("hook_library").update({ score: p.score, uses: 1 }).eq("plan_item_id", p.planItemId).eq("source", "generated");
          if (p.score >= WINNER && p.hookText) {
            const { count } = await db().from("hook_library").select("id", { count: "exact", head: true }).eq("source", "own_winner").eq("text", p.hookText);
            if (!count) {
              await db().from("hook_library").insert({ text: p.hookText, platform: p.platform, source: "own_winner", plan_item_id: p.planItemId, score: p.score, uses: 1 });
              winners++;
            }
          }
        }

        const today = zonedParts(new Date(), tz).day;
        const since = new Date(Date.now() - 7 * 86400_000).toISOString();
        const prevSince = new Date(Date.now() - 14 * 86400_000).toISOString();
        const f = await followers(db(), today);
        const stats: WeekStats = { ...weekStats(scored, since, prevSince), followers: f.now, followersChange: f.change };

        // Top and bottom videos of the last 30 days, for the "why" step
        const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString();
        const videos = scored.filter((p) => p.media?.type === "video" && p.media.storage_key && p.score !== null && p.publishedAt >= monthAgo).sort((a, b) => b.score! - a.score!);
        const pick = videos.length >= 2 ? [videos[0], videos[videos.length - 1]] : videos.slice(0, 1);

        return {
          language: profile?.language ?? "en",
          weekStart: weekStartOf(addDays(today, -7)),
          posts: posts.length,
          rejected: rejected.length,
          learnings: learnings.filter((l) => l.sample_size >= 1),
          winners,
          stats,
          videos: pick.map((p) => ({ key: p.media!.storage_key!, score: p.score!, caption: p.caption.slice(0, 200), platform: p.platform })),
          baselineFrom: Object.fromEntries(Object.entries(base).map(([k, b]) => [k, b.from])),
        };
      },
      (r) => `Scored ${r.posts} posts${r.rejected ? ` and ${r.rejected} skipped ones` : ""} into ${r.learnings.length} learnings${r.winners ? `, ${r.winners} new winning hooks` : ""}`
    );
    if (!result.posts && !result.rejected) return { learned: 0 };

    const videoNotes = await optional(
      task(
        "why-videos",
        async (track) => {
          const notes: string[] = [];
          for (const v of result.videos) {
            const res = await ai.analyzeVideo<{ answer: string }>(
              urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, v.key),
              `This ${v.platform} video scored ${v.score.toFixed(2)}× the account's usual engagement. In 2 sentences, say what about its hook, pacing, visuals and message most likely explains that. Answer in JSON: { "answer": string }`
            );
            track(res.usage);
            notes.push(`Video (${v.score.toFixed(2)}×): ${res.data.answer}`);
          }
          return notes;
        },
        (r) => `Looked at why ${r.length} videos did well or badly`
      )
    );

    await task(
      "insights-and-report",
      async (track) => {
        const [pillars, personas] = await Promise.all([db().from("content_pillars").select("id, name"), db().from("personas").select("id, name")]);
        const names = new Map([...(pillars.data ?? []), ...(personas.data ?? [])].map((r) => [r.id, r.name]));
        const label = (l: Learning) => names.get(l.value) ?? l.value;
        // The strongest signals either way, confident ones first
        const ranked = result.learnings
          .filter((l) => l.platform === null)
          .sort((a, b) => Number(b.sample_size >= MIN_CONFIDENT) - Number(a.sample_size >= MIN_CONFIDENT) || Math.abs(b.score - 1) - Math.abs(a.score - 1))
          .slice(0, 14);
        const s = result.stats;
        const lines = [
          `Write in language: ${result.language}`,
          "",
          "LEARNINGS (score: 1.0 = the account's usual engagement)",
          ...ranked.map((l, i) => `[L${i + 1}] ${DIMENSION_NAMES[l.dimension]} "${label(l)}": ${l.score.toFixed(2)}× from ${l.sample_size} posts${l.sample_size < MIN_CONFIDENT ? " (early sign)" : ""}`),
          "",
          "THIS WEEK",
          `Posts: ${s.posts} (week before: ${s.prevPosts})`,
          `Reach: ${s.reach}, engagements: ${s.engagements}`,
          `Engagement rate: ${s.er !== null ? (s.er * 100).toFixed(2) + "%" : "not available yet"} (week before: ${s.prevEr !== null ? (s.prevEr * 100).toFixed(2) + "%" : "n/a"})`,
          s.best ? `Best post: ${s.best.platform}, ${s.best.score.toFixed(2)}× usual: "${s.best.caption}"` : "Best post: none yet",
          s.followers !== null ? `Followers: ${s.followers} (${(s.followersChange ?? 0) >= 0 ? "+" : ""}${s.followersChange ?? 0} this week)` : "",
          ...(videoNotes ?? []),
        ];
        const res = await ai.structured(insightsSchema, lines.join("\n"), { system: INSIGHTS_SYSTEM, model: MODELS.analyze });
        track(res.usage);

        // Every insight must name its numbers; otherwise code writes it
        for (const [i, l] of ranked.entries()) {
          const written = res.data.insights.find((x) => x.key.replace(/\W/g, "").toUpperCase() === `L${i + 1}`)?.insight;
          const insight =
            written && /\d/.test(written)
              ? written
              : `${DIMENSION_NAMES[l.dimension]} "${label(l)}" gets ${l.score.toFixed(2)}× the usual engagement over ${l.sample_size} posts${l.sample_size < MIN_CONFIDENT ? " (early sign)" : ""}.`;
          await db().from("learnings").update({ insight }).eq("dimension", l.dimension).eq("value", l.value).is("platform", null);
        }

        const r = res.data.report;
        const { error } = await db()
          .from("weekly_reports")
          .upsert({ week_start: result.weekStart, headline: r.headline, summary: r.summary, next_week: r.nextWeek, stats: { ...s, baselineFrom: result.baselineFrom } }, { onConflict: "business_id,week_start" });
        if (error) throw error;

        await notify(db(), {
          kind: "weekly_report",
          title: r.headline,
          body: [r.summary, r.nextWeek.length ? `Next week:\n${r.nextWeek.map((n) => `• ${n}`).join("\n")}` : ""].filter(Boolean).join("\n\n"),
          link: "/performance",
          email: true,
          actionLabel: "See the full report",
        });
        return r;
      },
      (r) => `Wrote the weekly report: ${r.headline}`
    );
    return { learned: result.learnings.length };
  }
);
