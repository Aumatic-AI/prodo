import type { GetStepTools } from "inngest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { inngest } from "@/jobs/client";
import { businessDb } from "@/lib/supabase/business";
import { setAgentState, type ResearchAgent } from "@/core/onboarding/research";
import { agentStep } from "@/agents/run";
import { trace } from "@/lib/trace";
import type { Usage } from "@/providers/usage";
import { loadResearchContext, type ResearchContext } from "./context";

export type Step = GetStepTools<typeof inngest>;
type Track = (usage: Usage | Usage[]) => void;

/** What every research agent gets. */
export interface AgentKit {
  businessId: string;
  /** The business's database (service role, limited to this business) */
  db: () => SupabaseClient;
  runId: string;
  /** Extra input from whoever started the agent, e.g. the client's note on "Regenerate" */
  note: string | null;
  step: Step;
  ctx: ResearchContext;
  /** agentStep with this agent's name and run id filled in */
  task: <T>(id: string, fn: (track: Track) => Promise<T>, summary?: (result: T) => string) => Promise<T>;
}

/**
 * Wraps a research agent as its own Inngest function, started by the onboarding run with
 * step.invoke. Marks the agent running, loads the business context, runs it, and records
 * the one-line summary it returns (or the error, when it fails for good).
 */
type ResearchEvent = `research/${"website-analyst" | "visual-identity-analyst" | "social-market-analyst" | "brand-strategist"}`;

export function defineResearchAgent(agent: ResearchAgent, run: (kit: AgentKit) => Promise<string>) {
  const slug = agent.replace(/_/g, "-");

  return inngest.createFunction(
    {
      id: `agent-${slug}`,
      retries: 2,
      onFailure: async ({ error, event }) => {
        trace.scope({ runId: event.data.event.data.runId, agent }, () => trace.emit("agent-end", { status: "failed", error: error.message }));
        await setAgentState(businessDb(event.data.event.data.businessId), agent, {
          state: "failed",
          error: error.message,
          finishedAt: new Date().toISOString(),
        });
      },
    },
    { event: `research/${slug}` as ResearchEvent },
    async ({ event, step }) => {
      const { runId, businessId } = event.data;
      const db = () => businessDb(businessId);
      // Inngest runs step callbacks outside the handler's async context, so each one sets the trace context
      // itself. Trace events are written inside steps because the handler re-runs between steps.
      const traced =
        <T>(fn: () => Promise<T>) =>
        () =>
          trace.scope({ runId, agent }, fn);

      await step.run(
        "start",
        traced(async () => {
          trace.emit("agent-start", { note: event.data.note ?? undefined });
          await setAgentState(db(), agent, { state: "running" });
        })
      );
      const ctx = (await step.run(
        "load-context",
        traced(() => loadResearchContext(db()))
      )) as ResearchContext;

      const task: AgentKit["task"] = (id, fn, summary) => agentStep(step, id, { agent, businessId, runId, summary }, fn);

      const note: string | null = event.data.note ?? null;
      const summary = await run({ businessId, db, runId, note, step, ctx, task });
      await step.run(
        "finish",
        traced(async () => {
          trace.emit("agent-end", { status: "done", summary });
          await setAgentState(db(), agent, { state: "done", summary, finishedAt: new Date().toISOString() });
        })
      );
      return { summary };
    }
  );
}

/** Runs `fn` over `items` in groups of `size`, so a vendor isn't sent everything at once. */
export async function inGroups<T, R>(items: T[], size: number, fn: (item: T, index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += size) {
    results.push(...(await Promise.all(items.slice(i, i + size).map((item, j) => fn(item, i + j)))));
  }
  return results;
}
