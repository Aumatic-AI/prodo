import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { userMessage } from "@/core/errors";
import { PARALLEL_AGENTS, RESEARCH_AGENTS, STRATEGIST, readResearch, setAgentState, setResearchState, type ResearchAgent } from "@/core/onboarding/research";
import { websiteAnalyst } from "@/agents/website-analyst";
import { visualIdentityAnalyst } from "@/agents/visual-identity";
import { socialMarketAnalyst } from "@/agents/social-market";
import { brandStrategist } from "@/agents/brand-strategist";
import { snapshot, trace } from "@/lib/trace";

const AGENT_FUNCTIONS = {
  website_analyst: websiteAnalyst,
  visual_identity_analyst: visualIdentityAnalyst,
  social_market_analyst: socialMarketAnalyst,
  brand_strategist: brandStrategist,
} as const;

type Outcome = { agent: ResearchAgent; ok: true } | { agent: ResearchAgent; ok: false; error: string };

/**
 * Brand research: on submit, on retry and on "Refresh brand".
 * Agents 1–3 run in parallel (each its own function); when they all finish, the Brand Strategist
 * writes the Brand Bible draft. During onboarding a finished run moves the client to the Bible review.
 */
export const onboardingRun = inngest.createFunction(
  {
    id: "onboarding-run",
    concurrency: [{ limit: 1 }],
    retries: 1,
    onFailure: async ({ error, event }) => {
      trace.scope({ runId: event.data.event.data.runId }, () => trace.emit("run-end", { status: "failed", error: error.message }));
      const db = createAdminClient();
      await setResearchState(db, ["state"], "failed");
      await setResearchState(db, ["error"], error.message || "Research stopped unexpectedly. Try again.");
    },
  },
  { event: "onboarding/started" },
  async ({ event, step }) => {
    const { runId } = event.data;
    const requested: ResearchAgent[] = event.data.agents ?? [...RESEARCH_AGENTS];
    // Inngest runs step callbacks outside this context, so each traced step sets it itself
    const traced =
      <T>(fn: () => Promise<T>) =>
      () =>
        trace.scope({ runId }, fn);

    if (trace.enabled) {
      // Trace log only (TRACE_LOG=1): which agents run and the database before they start
      await step.run(
        "trace-start",
        traced(async () => {
          trace.emit("run-start", { agents: requested, attempt: event.data.attempt });
          await snapshot(createAdminClient(), "start");
        })
      );
    }

    const run = (agent: ResearchAgent): Promise<Outcome> =>
      step
        .invoke(`run-${agent}`, { function: AGENT_FUNCTIONS[agent], data: { runId }, timeout: "45m" })
        .then(() => ({ agent, ok: true as const }))
        .catch((err: unknown) => ({ agent, ok: false as const, error: userMessage(err) }));

    // A failed research agent doesn't stop the others
    const outcomes: Outcome[] = await Promise.all(PARALLEL_AGENTS.filter((a) => requested.includes(a)).map(run));
    // The Strategist needs all three, so it only runs once they've all succeeded
    if (!outcomes.some((o) => !o.ok) && requested.includes(STRATEGIST)) outcomes.push(await run(STRATEGIST));

    const failed = outcomes.filter((o): o is Extract<Outcome, { ok: false }> => !o.ok);
    return step.run(
      "finish",
      traced(async () => {
        const db = createAdminClient();
        const now = new Date().toISOString();

        if (failed.length) {
          // An agent that timed out never got to record its own failure
          const { research } = await readResearch(db);
          for (const f of failed) {
            if (research?.agents[f.agent]?.state !== "failed") await setAgentState(db, f.agent, { state: "failed", error: f.error, finishedAt: now });
          }
          await setResearchState(db, ["error"], "Some research didn't finish. Retry to run only the parts that failed.");
          await setResearchState(db, ["state"], "failed");
          await snapshot(db, "end");
          trace.emit("run-end", { status: "failed", failed: failed.map((f) => f.agent) });
          return { status: "failed", failed: failed.map((f) => f.agent) };
        }

        await setResearchState(db, ["finishedAt"], now);
        await setResearchState(db, ["state"], "done");
        // During onboarding: on to the Brand Bible review. After onboarding ("Refresh brand"), status stays done.
        const { error } = await db.from("business_profile").update({ onboarding_status: "review" }).eq("id", 1).neq("onboarding_status", "done");
        if (error) throw error;
        await snapshot(db, "end");
        trace.emit("run-end", { status: "done" });
        return { status: "done" };
      })
    );
  }
);

/** "Regenerate with a note": the Strategist writes a new draft from the same research. */
export const regenerateBible = inngest.createFunction(
  { id: "regenerate-bible", concurrency: [{ limit: 1 }], retries: 0 },
  { event: "brand/regenerate" },
  async ({ event, step }) => {
    await step.run("trace-start", () =>
      trace.scope({ runId: event.data.runId }, () => trace.emit("run-start", { agents: ["brand_strategist"], note: event.data.note }))
    );
    await step.invoke("run-brand-strategist", { function: brandStrategist, data: { runId: event.data.runId, note: event.data.note }, timeout: "20m" });
    return { status: "done" };
  }
);
