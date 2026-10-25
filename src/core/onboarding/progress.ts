import type { SupabaseClient } from "@supabase/supabase-js";
import { isStale, readResearch, type ResearchAgent, type ResearchState } from "./research";

/** One logged agent step, for the live activity list. */
export interface ResearchActivity {
  id: string;
  agent: ResearchAgent | string;
  status: "running" | "done" | "failed";
  summary: string | null;
  error: string | null;
  createdAt: string;
}

export interface ResearchProgress {
  /** business_profile.onboarding_status */
  status: string;
  research: ResearchState | null;
  /** Newest first */
  activity: ResearchActivity[];
  /** Steps finished per agent */
  stepsDone: Partial<Record<string, number>>;
  costUsd: number;
  lastActivityAt: string | null;
  /** Running but nothing logged for a long time: offer a retry */
  stale: boolean;
}

const ACTIVITY_LIMIT = 40;

export async function loadProgress(db: SupabaseClient): Promise<ResearchProgress> {
  const { status, research } = await readResearch(db);
  // Submitted but no research was ever set up (e.g. before research existed): offer a retry
  if (!research) return { status, research: null, activity: [], stepsDone: {}, costUsd: 0, lastActivityAt: null, stale: status === "analyzing" };

  const { data, error } = await db
    .from("agent_runs")
    .select("id, agent, status, summary, error, cost_usd, created_at")
    .eq("run_id", research.id)
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;

  const rows = data ?? [];
  const stepsDone: Record<string, number> = {};
  for (const r of rows) if (r.status === "done") stepsDone[r.agent] = (stepsDone[r.agent] ?? 0) + 1;
  const lastActivityAt = rows[0]?.created_at ?? null;

  return {
    status,
    research,
    activity: rows
      .filter((r) => r.summary || r.error || r.status === "running")
      .slice(0, ACTIVITY_LIMIT)
      .map((r) => ({ id: r.id, agent: r.agent, status: r.status, summary: r.summary, error: r.error, createdAt: r.created_at })),
    stepsDone,
    costUsd: Number(rows.reduce((sum, r) => sum + Number(r.cost_usd ?? 0), 0).toFixed(4)),
    lastActivityAt,
    stale: isStale(research, lastActivityAt),
  };
}
