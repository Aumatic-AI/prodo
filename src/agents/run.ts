import { businessDb } from "@/lib/supabase/business";
import { NonRetriableError } from "inngest";
import { classify, isAccountWide, userMessage } from "@/core/errors";
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
  /** The business the work is for: its budget, its pause switch, its agent_runs */
  businessId: string;
  /** Groups the steps of one workflow run, e.g. one onboarding research */
  runId?: string;
  planId?: string;
  planItemId?: string;
  mediaId?: string;
  inngestRunId?: string;
  input?: unknown;
  /** The step's id (set by agentStep), for the trace log */
  stepId?: string;
  /** Inngest's attempt at this step (0-based) and how many it gets, so a failure can say whether another try follows */
  attempt?: number;
  maxAttempts?: number;
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
  const db = businessDb(opts.businessId);
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
    // Money spent before the failure still counts. `retrying` tells the activity feed another try follows.
    await finish({ status: "failed", error: userMessage(err), output: willRetry(err, opts) ? { retrying: true } : null });
    throw err;
  }
}

/** Inngest will try the step again: attempts are left, and the error isn't one a retry can't fix. */
function willRetry(err: unknown, opts: Pick<AgentStepOptions<unknown>, "attempt" | "maxAttempts">): boolean {
  if (opts.attempt === undefined || !opts.maxAttempts) return false;
  if (!classify(err).retryable) return false;
  return opts.attempt + 1 < opts.maxAttempts;
}

export interface OptionalOptions {
  /** Gets the exact reason when the work fails, e.g. skipped.note("reading a competitor's ads") */
  failed?: (message: string) => void;
  /**
   * The agent can do without this service altogether (Zernio's account list, Twelve Labs watching
   * videos): carry on even after an error about the whole account, like no credit or a wrong key.
   */
  anyError?: boolean;
}

/**
 * For work the agent can do without (one page, one competitor): returns null instead of failing
 * the whole run once Inngest has used up its retries. An error about the whole account (no credit, a
 * wrong key, a daily cap, the budget) stops the agent instead: every later step would fail the same way.
 */
export async function optional<T>(work: Promise<T>, opts: OptionalOptions = {}): Promise<T | null> {
  try {
    return await work;
  } catch (err) {
    if (isAccountWide(err) && !opts.anyError) throw new NonRetriableError(err instanceof Error ? err.message : userMessage(err), { cause: err });
    opts.failed?.(userMessage(err));
    return null;
  }
}

/**
 * What an agent skipped and why, for its summary: "Skipped 2: describing the visual style (…); …".
 * Made fresh on every Inngest request, so replays rebuild the same list.
 */
export class Skipped {
  private items: { what: string; why: string }[] = [];

  /** For optional(): `failed: skipped.note("describing the visual style")` */
  note = (what: string) => (why: string) => {
    this.items.push({ what, why: why.replace(/\.$/, "") });
  };

  get count() {
    return this.items.length;
  }

  /** The agent's summary with what it skipped after it, the first few with their reasons */
  after(summary: string, max = 3): string {
    if (!this.items.length) return summary;
    const shown = this.items.slice(0, max).map((s) => `${s.what} (${s.why})`);
    const more = this.items.length > max ? `; and ${this.items.length - max} more` : "";
    return `${summary.replace(/\.$/, "")}. Skipped ${this.items.length}: ${shown.join("; ")}${more}.`;
  }
}
