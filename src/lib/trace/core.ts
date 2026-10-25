import { AsyncLocalStorage } from "node:async_hooks";
import { appendFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { scrub } from "./redact";

// Trace recorder for development: every outside call and database change of a research run is
// appended to .logs/research/<run id>.jsonl, tagged with its agent and step. `npm run trace`
// turns that file into a readable report. Off unless TRACE_LOG=1, and never in production.
// Tracing must never break the app, so every write is wrapped.

export interface TraceContext {
  runId?: string;
  agent?: string;
  step?: string;
  attempt?: number;
  /** Events inside are not recorded (for the recorder's own reads) */
  muted?: boolean;
}

export interface TraceEvent extends Record<string, unknown> {
  ts: number;
  seq: number;
  type: string;
  runId?: string;
  agent?: string;
  step?: string;
  attempt?: number;
}

interface TraceState {
  als: AsyncLocalStorage<TraceContext>;
  seq: number;
  attempts: Map<string, number>;
}

// One shared state, even when the bundler loads this file more than once
const holder = globalThis as unknown as { __prodoTrace?: TraceState };
const state = (holder.__prodoTrace ??= { als: new AsyncLocalStorage(), seq: 0, attempts: new Map() });

export const enabled = process.env.TRACE_LOG === "1" && process.env.NODE_ENV !== "production";

const safeName = (name: string) => name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 80);

export function logFile(runId: string | undefined): string {
  return path.join(process.cwd(), ".logs", "research", `${safeName(runId ?? "_other")}.jsonl`);
}

export function emit(type: string, fields: Record<string, unknown> = {}): void {
  if (!enabled) return;
  try {
    const ctx = state.als.getStore();
    if (ctx?.muted) return;
    const event: TraceEvent = {
      ts: Date.now(),
      ...fields,
      seq: ++state.seq,
      type,
      runId: ctx?.runId,
      agent: ctx?.agent,
      step: ctx?.step,
      attempt: ctx?.attempt,
    };
    const file = logFile(event.runId);
    mkdirSync(path.dirname(file), { recursive: true });
    appendFileSync(file, `${scrub(JSON.stringify(event))}\n`);
  } catch {
    // Tracing is best effort
  }
}

/** Runs `fn` with extra context; events inside carry it. */
export function scope<T>(ctx: TraceContext, fn: () => T): T {
  if (!enabled) return fn();
  return state.als.run({ ...state.als.getStore(), ...ctx }, fn);
}

/** Runs `fn` without recording anything. */
export function mute<T>(fn: () => T): T {
  return scope({ muted: true }, fn);
}

/** 1 for a step's first try, 2 for its first retry, and so on. */
export function nextAttempt(runId: string | undefined, agent: string, step: string | undefined): number | undefined {
  if (!enabled) return undefined;
  const key = `${runId}|${agent}|${step}`;
  const attempt = (state.attempts.get(key) ?? 0) + 1;
  state.attempts.set(key, attempt);
  return attempt;
}
