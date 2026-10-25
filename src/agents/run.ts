import { createAdminClient } from "@/lib/supabase/admin";
import { userMessage } from "@/core/errors";
import { toInngestError } from "@/jobs/to-inngest-error";
import { sumUsage, type Usage } from "@/providers/usage";
import { assertBudget } from "./budget";
import { preview, trace } from "@/lib/trace";

export type AgentName =
  | "website_analyst"
  | "visual_identity_analyst"
  | "social_market_analyst"
  | "brand_strategist"
  | "planner"
  | "creative_director"
  | "producer"
  | "qa_critic"
  | "publisher"
  | "performance_analyst";

export interface AgentStepOptions<T> {
  agent: AgentName;
  /** Groups the steps of one workflow run, e.g. one onboarding research */
  runId?: string;
  planId?: string;
  planItemId?: string;
  mediaId?: string;
  inngestRunId?: string;
  input?: unknown;
  /** The step's id (set by agentStep), for the trace log */
  stepId?: string;
  /** One plain line for the activity feed, e.g. "Read 23 pages" */
  summary?: (result: T) => string;
  output?: (result: T) => unknown;
}

type Track = (usage: Usage | Usage[]) => void;

export interface StepLike {
  run: (id: string, fn: () => Promise<any>) => Promise<any>;
}

/** Inngest step that checks the budget, then logs its work and cost to agent_runs. */
export async function agentStep<T>(step: StepLike, id: string, opts: AgentStepOptions<T>, fn: (track: Track) => Promise<T>): Promise<T> {
  return step.run(id, () => runAgentStep({ ...opts, stepId: id }, fn).catch(toInngestError));
}

/** The step body, usable outside Inngest (scripts). */
export async function runAgentStep<T>(opts: AgentStepOptions<T>, fn: (track: Track) => Promise<T>): Promise<T> {
  const attempt = trace.nextAttempt(opts.runId, opts.agent, opts.stepId);
  return trace.scope({ runId: opts.runId, agent: opts.agent, step: opts.stepId, attempt }, () => runStep(opts, fn));
}

async function runStep<T>(opts: AgentStepOptions<T>, fn: (track: Track) => Promise<T>): Promise<T> {
  const db = createAdminClient();
  const stepStarted = Date.now();
  trace.emit("step-start", { input: opts.input === undefined ? undefined : preview(opts.input) });
  try {
    await assertBudget(db);
  } catch (err) {
    trace.emit("step-end", { status: "failed", ms: Date.now() - stepStarted, error: userMessage(err) });
    throw err;
  }

  const { data: run, error } = await db
    .from("agent_runs")
    .insert({
      agent: opts.agent,
      run_id: opts.runId ?? null,
      plan_id: opts.planId ?? null,
      plan_item_id: opts.planItemId ?? null,
      media_id: opts.mediaId ?? null,
      inngest_run_id: opts.inngestRunId ?? null,
      status: "running",
      input: opts.input ?? null,
    })
    .select("id")
    .single();
  if (error) throw error;

  const usages: Usage[] = [];
  const track: Track = (u) => usages.push(...(Array.isArray(u) ? u : [u]));
  const started = Date.now();

  const finish = (fields: Record<string, unknown>, result?: unknown) => {
    const total = sumUsage(usages);
    trace.emit("step-end", {
      ts: stepStarted,
      ms: Date.now() - stepStarted,
      status: fields.status,
      summary: fields.summary ?? undefined,
      error: fields.error ?? undefined,
      costUsd: Number(total.costUsd.toFixed(4)),
      tokensIn: total.tokensIn || undefined,
      tokensOut: total.tokensOut || undefined,
      model: total.model,
      output: result === undefined ? undefined : preview(result, { str: 300 }),
    });
    return db
      .from("agent_runs")
      .update({
        model: total.model ?? null,
        tokens_in: total.tokensIn ?? null,
        tokens_out: total.tokensOut ?? null,
        cost_usd: Number(total.costUsd.toFixed(4)),
        duration_ms: Date.now() - started,
        ...fields,
      })
      .eq("id", run.id);
  };

  try {
    const result = await fn(track);
    await finish(
      {
        status: "done",
        summary: opts.summary?.(result) ?? null,
        output: opts.output?.(result) ?? null,
      },
      result
    );
    return result;
  } catch (err) {
    // Money spent before the failure still counts
    await finish({ status: "failed", error: userMessage(err) });
    throw err;
  }
}

/**
 * For work the agent can do without (one page, one competitor): returns null instead of failing
 * the whole run once Inngest has used up its retries.
 */
export async function optional<T>(work: Promise<T>): Promise<T | null> {
  try {
    return await work;
  } catch {
    return null;
  }
}
