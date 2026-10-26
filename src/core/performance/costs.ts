import type { SupabaseClient } from "@supabase/supabase-js";

// What the agents cost: one month of agent_runs, by agent, by day, per finished asset and per weekly plan.

export interface CostsView {
  month: string;
  total: number;
  budget: number;
  byAgent: { agent: string; cost: number; steps: number }[];
  byDay: { date: string; cost: number }[];
  byMedia: { mediaId: string; type: string; idea: string | null; storage_key: string | null; status: string; planItemId: string | null; cost: number }[];
  byPlan: { planId: string; weekStart: string; cost: number; posts: number }[];
  /** Average cost of an asset that finished (ready) this month */
  perAsset: number | null;
  /** Spend by kind of work */
  byKind: { research: number; content: number; learning: number; other: number };
}

const RESEARCH = ["website_analyst", "visual_identity_analyst", "social_market_analyst", "brand_strategist"];
const CONTENT = ["planner", "creative_director", "producer", "qa_critic", "publisher"];

const round = (n: number) => Math.round(n * 10000) / 10000;

export async function loadCosts(db: SupabaseClient, month: string): Promise<CostsView> {
  const [y, m] = month.split("-").map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1)).toISOString();
  const end = new Date(Date.UTC(y, m, 1)).toISOString();

  const [runs, settings] = await Promise.all([
    db.from("agent_runs").select("agent, cost_usd, created_at, media_id, plan_id").gte("created_at", start).lt("created_at", end).limit(20000),
    db.from("app_settings").select("monthly_budget_usd").single(),
  ]);
  if (runs.error) throw runs.error;
  const rows = (runs.data ?? []).map((r) => ({ ...r, cost: Number(r.cost_usd ?? 0) }));

  const sumBy = <K extends string>(key: (r: (typeof rows)[number]) => K | null) => {
    const map = new Map<K, { cost: number; steps: number }>();
    for (const r of rows) {
      const k = key(r);
      if (k === null) continue;
      const v = map.get(k) ?? { cost: 0, steps: 0 };
      v.cost += r.cost;
      v.steps += 1;
      map.set(k, v);
    }
    return map;
  };

  const agents = sumBy((r) => r.agent);
  const days = sumBy((r) => r.created_at.slice(0, 10));
  const media = sumBy((r) => r.media_id);
  const plans = sumBy((r) => r.plan_id);

  const mediaIds = [...media.keys()];
  const planIds = [...plans.keys()];
  const [mediaRows, planRows, itemCounts] = await Promise.all([
    mediaIds.length ? db.from("media").select("id, type, idea, storage_key, status, plan_item_id").in("id", mediaIds) : Promise.resolve({ data: [] as any[] }),
    planIds.length ? db.from("content_plans").select("id, week_start").in("id", planIds) : Promise.resolve({ data: [] as any[] }),
    planIds.length ? db.from("plan_items").select("plan_id").in("plan_id", planIds) : Promise.resolve({ data: [] as any[] }),
  ]);
  const mediaInfo = new Map((mediaRows.data ?? []).map((r: any) => [r.id, r]));
  const weeks = new Map((planRows.data ?? []).map((r: any) => [r.id, r.week_start]));
  const counts = new Map<string, number>();
  for (const r of itemCounts.data ?? []) counts.set(r.plan_id, (counts.get(r.plan_id) ?? 0) + 1);

  const byMedia = [...media.entries()]
    .map(([id, v]) => {
      const info: any = mediaInfo.get(id);
      return { mediaId: id, type: info?.type ?? "image", idea: info?.idea ?? null, storage_key: info?.storage_key ?? null, status: info?.status ?? "deleted", planItemId: info?.plan_item_id ?? null, cost: round(v.cost) };
    })
    .sort((a, b) => b.cost - a.cost);
  const finished = byMedia.filter((x) => x.status === "ready");
  const sumWhere = (list: string[]) => rows.filter((r) => list.includes(r.agent)).reduce((s, r) => s + r.cost, 0);
  const total = rows.reduce((s, r) => s + r.cost, 0);

  return {
    month,
    total: round(total),
    budget: Number(settings.data?.monthly_budget_usd ?? 0),
    byAgent: [...agents.entries()].map(([agent, v]) => ({ agent, cost: round(v.cost), steps: v.steps })).sort((a, b) => b.cost - a.cost),
    byDay: [...days.entries()].map(([date, v]) => ({ date, cost: round(v.cost) })).sort((a, b) => a.date.localeCompare(b.date)),
    byMedia: byMedia.slice(0, 40),
    byPlan: [...plans.entries()].map(([planId, v]) => ({ planId, weekStart: weeks.get(planId) ?? "", cost: round(v.cost), posts: counts.get(planId) ?? 0 })).sort((a, b) => b.weekStart.localeCompare(a.weekStart)),
    perAsset: finished.length ? round(finished.reduce((s, x) => s + x.cost, 0) / finished.length) : null,
    byKind: {
      research: round(sumWhere(RESEARCH)),
      content: round(sumWhere(CONTENT)),
      learning: round(sumWhere(["performance_analyst"])),
      other: round(total - sumWhere([...RESEARCH, ...CONTENT, "performance_analyst"])),
    },
  };
}
