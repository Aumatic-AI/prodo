import { agentStep, type AgentName, type StepLike } from "@/agents/run";
import type { Usage } from "@/providers/usage";

// One logged, budget-checked step of the weekly loop (see agentStep), with the plan and slot filled in.

export type Track = (usage: Usage | Usage[]) => void;
export type Task = <T>(id: string, fn: (track: Track) => Promise<T>, summary?: (result: T) => string) => Promise<T>;

export interface TaskScope {
  businessId: string;
  planId: string;
  itemId?: string;
  mediaId?: string;
}

/** Steps for one agent, logged against the plan (runId = plan id) and slot. */
export function taskFor(step: StepLike, agent: AgentName, scope: TaskScope): Task {
  return (id, fn, summary) =>
    agentStep(step, id, { agent, businessId: scope.businessId, runId: scope.planId, planId: scope.planId, planItemId: scope.itemId, mediaId: scope.mediaId, summary }, fn);
}

/** Logs money spent outside a task (e.g. a vendor job made again while polling) as its own agent_runs row. */
export async function logUsage(scope: TaskScope & { agent: AgentName }, usage: Usage, summary: string): Promise<void> {
  const { businessDb } = await import("@/lib/supabase/business");
  await businessDb(scope.businessId)
    .from("agent_runs")
    .insert({
      agent: scope.agent,
      run_id: scope.planId,
      plan_id: scope.planId,
      plan_item_id: scope.itemId ?? null,
      media_id: scope.mediaId ?? null,
      status: "done",
      summary,
      model: usage.model ?? null,
      cost_usd: Number(usage.costUsd.toFixed(4)),
    });
}
