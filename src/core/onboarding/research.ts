import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { ownRow } from "@/lib/supabase/own-row";

// Brand research progress, kept in business_profile.onboarding.research.
// Agents write it in parallel through set_research_state (one atomic update per write).

/** Agents 1–3 run in parallel; the Brand Strategist runs after them and writes the Brand Bible draft. */
export const PARALLEL_AGENTS = ["website_analyst", "visual_identity_analyst", "social_market_analyst"] as const;
export const STRATEGIST = "brand_strategist" as const;
export const RESEARCH_AGENTS = [...PARALLEL_AGENTS, STRATEGIST] as const;
export type ResearchAgent = (typeof RESEARCH_AGENTS)[number];

export type AgentState = {
  state: "queued" | "running" | "done" | "failed";
  /** One plain line, e.g. "Read 23 pages, found 6 products" */
  summary?: string;
  error?: string;
  finishedAt?: string;
};

export interface ResearchState {
  /** Same for the whole research, across retries. agent_runs.run_id holds it. */
  id: string;
  /** Changes on every retry; the Inngest event id, so a double click starts one run */
  attempt: string;
  state: "running" | "failed" | "done";
  startedAt: string;
  finishedAt?: string;
  error?: string;
  agents: Partial<Record<ResearchAgent, AgentState>>;
}

/** No step logged for this long means the run is stuck (e.g. the job server was down). */
export const STALE_AFTER_MS = 20 * 60_000;

function queued(agents: readonly ResearchAgent[]): ResearchState["agents"] {
  return Object.fromEntries(agents.map((a) => [a, { state: "queued" }]));
}

/** State for a fresh research run, written at submit. */
export function newResearch(): ResearchState {
  const id = crypto.randomUUID();
  return {
    id,
    attempt: id,
    state: "running",
    startedAt: new Date().toISOString(),
    agents: queued(RESEARCH_AGENTS),
  };
}

/** Agents that still need to run: everything not done. */
export function unfinishedAgents(research: ResearchState): ResearchAgent[] {
  return RESEARCH_AGENTS.filter((a) => research.agents[a]?.state !== "done");
}

/** Updates one key of the research state (or one agent, with path ["agents", name]). Service role only. */
export async function setResearchState(db: SupabaseClient, path: string[], value: unknown): Promise<void> {
  const { error } = await db.rpc("set_research_state", { path, value });
  if (error) throw error;
}

export function setAgentState(db: SupabaseClient, agent: ResearchAgent, value: AgentState): Promise<void> {
  return setResearchState(db, ["agents", agent], value);
}

export async function readResearch(db: SupabaseClient): Promise<{ status: string; research: ResearchState | null }> {
  const { data, error } = await db.from("business_profile").select("onboarding, onboarding_status").single();
  if (error) throw error;
  return {
    status: data.onboarding_status,
    research: data.onboarding?.research ?? null,
  };
}

/** True when a running research has logged nothing for STALE_AFTER_MS. */
export function isStale(research: ResearchState, lastActivityAt: string | null): boolean {
  if (research.state !== "running") return false;
  const last = Date.parse(lastActivityAt ?? research.startedAt);
  return Date.now() - last > STALE_AFTER_MS;
}

/** Replaces the whole research state (one writer: the client's own request). */
async function writeResearch(db: SupabaseClient, research: ResearchState): Promise<void> {
  const { data, error: readError } = await db.from("business_profile").select("onboarding").single();
  if (readError) throw readError;
  const { error } = await ownRow(db
    .from("business_profile")
    .update({ onboarding: { ...(data.onboarding ?? {}), research } }));
  if (error) throw error;
}

/**
 * Starts the agents that didn't finish again. Allowed after a failure or when the run is stuck.
 * Returns the new attempt and the agents to run, or started = false when the run is still going.
 */
export async function retryResearch(
  db: SupabaseClient,
  lastActivityAt: string | null
): Promise<{ research: ResearchState; agents: ResearchAgent[]; started: boolean }> {
  const { status, research } = await readResearch(db);
  if (!research) {
    if (status !== "analyzing") throw new AppError("There's no research to retry.", "INVALID_INPUT", false);
    // Submitted without a research run: start a fresh one
    const fresh = newResearch();
    await writeResearch(db, fresh);
    return { research: fresh, agents: [...RESEARCH_AGENTS], started: true };
  }
  if (research.state === "running" && !isStale(research, lastActivityAt)) {
    return { research, agents: [], started: false };
  }

  const agents = unfinishedAgents(research);
  const next: ResearchState = {
    ...research,
    attempt: crypto.randomUUID(),
    state: "running",
    error: undefined,
    finishedAt: undefined,
    agents: { ...research.agents, ...queued(agents) },
  };
  await writeResearch(db, next);
  return { research: next, agents, started: true };
}

/** "Refresh brand" after onboarding: a whole new research run. The approved Bible stays in use. */
export async function startRefresh(db: SupabaseClient, lastActivityAt: string | null): Promise<ResearchState> {
  const { research } = await readResearch(db);
  if (research?.state === "running" && !isStale(research, lastActivityAt)) {
    throw new AppError("Your brand is already being refreshed. Wait for it to finish.", "INVALID_INPUT", false);
  }
  const next = newResearch();
  await writeResearch(db, next);
  return next;
}

/**
 * Runs only some agents again: the Visual Identity Analyst after a logo change, the Social & Market
 * Analyst every month. The others show as done. Returns null when a research is already running.
 */
export async function startPartialRefresh(db: SupabaseClient, agents: ResearchAgent[]): Promise<ResearchState | null> {
  const { research } = await readResearch(db);
  if (research?.state === "running" && !isStale(research, null)) return null;
  const next = newResearch();
  for (const agent of RESEARCH_AGENTS) {
    if (!agents.includes(agent)) next.agents[agent] = { state: "done", summary: "Not part of this refresh" };
  }
  await writeResearch(db, next);
  return next;
}

/** "Regenerate with a note": queues the Strategist again on the latest research. */
export async function startRegenerate(db: SupabaseClient): Promise<ResearchState> {
  const { research } = await readResearch(db);
  const state = research?.agents[STRATEGIST]?.state;
  if (!research || (state !== "done" && state !== "failed")) {
    const busy = state === "running" || state === "queued";
    throw new AppError(busy ? "A new draft is already being written." : "The Brand Bible can't be regenerated before the research has finished.", "INVALID_INPUT", false);
  }
  const next: ResearchState = { ...research, agents: { ...research.agents, [STRATEGIST]: { state: "queued" } } };
  await writeResearch(db, next);
  return next;
}
