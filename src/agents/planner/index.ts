import { NonRetriableError } from "inngest";
import { inngest } from "@/jobs/client";
import { MODELS } from "@/config/models";
import { AppError, userMessage } from "@/core/errors";
import { notify } from "@/core/notifications/notify";
import { approvedBible } from "@/core/plans/plans";
import { createAdminClient } from "@/lib/supabase/admin";
import { agentStep } from "@/agents/run";
import { ai } from "@/providers/ai/registry";
import { PLANNER_SYSTEM, plannerSchema } from "@/prompts/agents/planner";
import { bestTimes, formatScores, loadPlannerContext } from "./context";
import { mergePlan, pillarMix } from "./merge";
import { buildPlannerPrompt } from "./prompt";
import { openPlan, savePlan } from "./save";
import { openDays, planSlots } from "./slots";
import { videoReady } from "@/providers/ffmpeg/client";
import { addDays, zonedParts } from "@/lib/zoned-time";

// Agent 5 · Planner
// Plans one week: open the plan → read the brand → slots by code (count, days, platforms, times,
// formats, pillar mix, experiments) → content per slot by AI (offering, persona, angle, reason)
// → checks by code → save → start production of every slot.

export const planner = inngest.createFunction(
  {
    id: "agent-planner",
    retries: 2,
    // One plan at a time; a second request for the same week waits, then finds it planned
    concurrency: [{ limit: 1 }],
    onFailure: async ({ event, error }) => {
      const db = createAdminClient();
      const weekStart = event.data.event.data.weekStart;
      await db.from("content_plans").update({ status: "failed", error: error.message }).eq("week_start", weekStart).eq("status", "planning");
      await notify(db, {
        kind: "agent_stopped",
        title: "Prodo couldn't plan the week",
        body: `The plan for the week of ${weekStart} stopped: ${error.message}`,
        link: "/week",
        email: true,
      });
    },
  },
  { event: "plan/requested" },
  async ({ event, step }) => {
    const { weekStart, replace = false } = event.data;
    const db = () => createAdminClient();

    const plan = await step.run("open-plan", async () => {
      try {
        const bible = await approvedBible(db());
        return await openPlan(db(), weekStart, bible.id, replace);
      } catch (err) {
        throw new NonRetriableError(userMessage(err));
      }
    });
    const task = <T>(id: string, fn: (track: (u: any) => void) => Promise<T>, summary?: (r: T) => string) =>
      agentStep(step, id, { agent: "planner", runId: plan.id, planId: plan.id, summary }, fn);

    const ctx = await task(
      "read-brand",
      () => loadPlannerContext(db(), weekStart),
      (r) => `Read the Brand Bible, ${r.offerings.length} offerings, ${r.personas.length} personas and ${r.learnings.length} learnings`
    );

    const planned = await task(
      "plan-slots",
      async () => {
        // Never a slot in the past: the current week starts tomorrow
        const today = zonedParts(new Date(), ctx.timezone).day;
        const firstDay = weekStart <= today ? addDays(today, 1) : weekStart;
        if (!openDays(weekStart, firstDay).length) {
          throw new AppError("This week is over. Plan next week instead.", "INVALID_INPUT", false);
        }
        if (!Object.values(ctx.postsPerWeek).some((n) => n > 0)) {
          throw new AppError("No posts per week are set. Set them in Settings → Automation, then plan again.", "INVALID_INPUT", false);
        }
        // No video slots while the video renderer isn't set up (nothing would be spent on them)
        const video = await videoReady();
        const result = planSlots({
          weekStart,
          firstDay,
          videoAllowed: video.ok,
          timezone: ctx.timezone,
          postsPerWeek: ctx.postsPerWeek,
          pillars: ctx.pillars,
          goal: ctx.goal,
          formatScores: formatScores(ctx),
          bestTimes: bestTimes(ctx),
        });
        if (!result.length) {
          throw new AppError(
            video.ok ? "Nothing to plan for the days left this week." : "The only platforms set take video, and videos aren't set up yet. Connect the video renderer first.",
            "INVALID_INPUT",
            false
          );
        }
        return { slots: result, firstDay, videoNote: video.ok ? null : video.reason };
      },
      (r) =>
        `Planned ${r.slots.length} slots from ${r.firstDay}: ${r.slots.filter((s) => s.isExperiment).length} experiments, ${[...new Set(r.slots.map((s) => s.format))].join(", ")}${r.videoNote ? " (no videos: the video renderer isn't set up)" : ""}`
    );

    const slots = planned.slots;
    const { prompt } = buildPlannerPrompt(ctx, slots);
    const reply = await task(
      "choose-content",
      async (track) => {
        const res = await ai.structured(plannerSchema, prompt, { system: PLANNER_SYSTEM, model: MODELS.analyze });
        track(res.usage);
        return res.data;
      },
      (r) => `Chose the angle, offering and persona for ${r.slots.length} slots. Theme: ${r.theme}`
    );

    const itemIds = await task(
      "check-and-save",
      async () => {
        // Labels are rebuilt the same way, so they mean the same thing as in the prompt
        const items = mergePlan(ctx, slots, reply, buildPlannerPrompt(ctx, slots).labels);
        const events = [...new Set(ctx.events.filter((e) => e.date >= weekStart).map((e) => e.name))];
        return savePlan(db(), plan.id, items, { theme: reply.theme, rationale: reply.rationale, mix: pillarMix(ctx, items), events });
      },
      (r) => `Saved the plan with ${r.length} slots`
    );

    await step.sendEvent(
      "start-production",
      itemIds.map((itemId) => ({ name: "plan-item/produce", id: `produce-${itemId}`, data: { itemId, planId: plan.id } }))
    );
    return { planId: plan.id, items: itemIds.length };
  }
);
