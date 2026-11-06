import { NonRetriableError } from "inngest";
import { inngest } from "@/jobs/client";
import { failureMessage } from "@/jobs/to-inngest-error";
import { MODELS } from "@/config/models";
import { AppError, userMessage } from "@/core/errors";
import { notify } from "@/core/notifications/notify";
import { approvedBible, planForWeek } from "@/core/plans/plans";
import { businessDb } from "@/lib/supabase/business";
import { agentStep } from "@/agents/run";
import { ai } from "@/providers/ai/registry";
import { PLANNER_BATCH_NOTE, PLANNER_SYSTEM, plannerSchema } from "@/prompts/agents/planner";
import { bestTimes, formatScores, loadPlannerContext, styleScores } from "./context";
import { mergePlan, pillarMix } from "./merge";
import { buildPlannerPrompt } from "./prompt";
import { loadExisting } from "./existing";
import { openPlan, saveBatch, savePlan } from "./save";
import { openDays, planSlots } from "./slots";
import { videoReady } from "@/providers/ffmpeg/client";
import { addDays, zonedParts } from "@/lib/zoned-time";

// Agent 5 · Planner
// Plans one week: open the plan → read the brand → slots by code (count, days, platforms, times,
// formats, pillar mix, experiments) → content per slot by AI (offering, persona, angle, reason)
// → checks by code → save → start production of every slot.
// "Auto-create" runs the same steps for a chosen number of posts over the next days: no week is
// replaced, the posts join the plans of the weeks they fall in, and each is made as a single ad.

export const planner = inngest.createFunction(
  {
    id: "agent-planner",
    retries: 2,
    // One plan at a time per business; a second request for the same week waits, then finds it planned
    concurrency: [{ limit: 1, key: "event.data.businessId" }],
    onFailure: async ({ event, error }) => {
      const { businessId, weekStart, batch } = event.data.event.data;
      const db = businessDb(businessId);
      const message = failureMessage(error);
      // A batch never touches a week's plan, so there's no plan to mark failed
      if (!batch) await db.from("content_plans").update({ status: "failed", error: message }).eq("week_start", weekStart).eq("status", "planning");
      await notify(db, {
        kind: "agent_stopped",
        title: batch ? "Prodo couldn't create your posts" : "Prodo couldn't plan the week",
        body: batch ? `Creating ${batch.static + batch.carousel + batch.video} post${batch.static + batch.carousel + batch.video === 1 ? "" : "s"} stopped: ${message}` : `The plan for the week of ${weekStart} stopped: ${message}`,
        link: "/week",
        email: true,
      });
    },
  },
  { event: "plan/requested" },
  async ({ event, step }) => {
    const { businessId, weekStart, replace = false, batch = null } = event.data;
    const db = () => businessDb(businessId);

    const plan = await step.run("open-plan", async () => {
      try {
        const bible = await approvedBible(db());
        // A batch joins the week's plan (a week of single ads is made when there is none); a week's plan is opened fresh
        return batch ? await planForWeek(db(), weekStart) : await openPlan(db(), weekStart, bible.id, replace);
      } catch (err) {
        throw new NonRetriableError(userMessage(err));
      }
    });
    const task = <T>(id: string, fn: (track: (u: any) => void) => Promise<T>, summary?: (r: T) => string) =>
      agentStep(step, id, { businessId, agent: "planner", runId: plan.id, planId: plan.id, summary }, fn);

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
        const firstDay = batch ? (batch.date && batch.date > today ? batch.date : addDays(today, 1)) : weekStart <= today ? addDays(today, 1) : weekStart;
        if (!batch && !openDays(weekStart, firstDay).length) {
          throw new AppError("This week is over. Plan next week instead.", "INVALID_INPUT", false);
        }
        if (!Object.values(ctx.postsPerWeek).some((n) => n > 0)) {
          throw new AppError("No posts per week are set. Set them in Settings → Automation, then plan again.", "INVALID_INPUT", false);
        }
        // No video slots while the video renderer isn't set up (nothing would be spent on them)
        const video = await videoReady();
        // A chosen day takes every post; otherwise the next 7 days (a batch) or the days left in the week
        const days = batch ? (batch.date ? [firstDay] : Array.from({ length: 7 }, (_, i) => addDays(firstDay, i))) : openDays(weekStart, firstDay);
        // Posts already set for these days (scheduled by hand, or made by Auto-create) are planned around
        const existing = await loadExisting(db(), days, ctx.timezone);
        const result = planSlots({
          weekStart,
          firstDay,
          videoAllowed: video.ok,
          timezone: ctx.timezone,
          postsPerWeek: ctx.postsPerWeek,
          pillars: ctx.pillars,
          goals: ctx.goals,
          mix: ctx.rules.mix,
          styles: { image: ctx.rules.imageStyles, video: ctx.rules.videoStyles },
          people: ctx.rules.people,
          talkingFootage: ctx.talkingFootage,
          styleScores: styleScores(ctx),
          formatScores: formatScores(ctx),
          bestTimes: bestTimes(ctx),
          batch: batch ? { counts: batch, days } : undefined,
          existing,
        });
        // Every kind asked for needs a platform that takes it
        const missing = batch ? (["static", "carousel", "video"] as const).filter((f) => batch[f] > 0 && !result.some((r) => r.format === f)) : [];
        if (missing.length) {
          const name = (f: string) => (f === "static" ? "image ads" : f === "carousel" ? "carousels" : "videos");
          throw new AppError(
            missing.includes("video") && !video.ok
              ? `Videos aren't set up yet: ${video.reason}`
              : `None of the platforms you post to take ${missing.map(name).join(" or ")}. Pick another kind, or change your platforms in Settings → Automation.`,
            "INVALID_INPUT",
            false
          );
        }
        if (!result.length) {
          throw new AppError(
            !video.ok
              ? "The only platforms set take video, and videos aren't set up yet. Connect the video renderer first."
              : ctx.rules.mix === "images"
                ? "The only platforms set take video, and your content is set to images only. Change it in Settings, then plan again."
                : existing.length
                  ? `The days left this week already have their posts: ${existing.length} ${existing.length === 1 ? "is" : "are"} already scheduled or planned.`
                  : "Nothing to plan for the days left this week.",
            "INVALID_INPUT",
            false
          );
        }
        return { slots: result, firstDay, existing: existing.length, videoNote: video.ok ? null : video.reason };
      },
      (r) =>
        `Planned ${r.slots.length} slots from ${r.firstDay}${r.existing ? ` around ${r.existing} posts already set` : ""}:${r.slots.filter((s) => s.isExperiment).length} experiments, ${[...new Set(r.slots.map((s) => s.format))].join(", ")}; styles ${[...new Set(r.slots.map((s) => s.style).filter(Boolean))].join(", ")}${r.videoNote ? " (no videos: the video renderer isn't set up)" : ""}`
    );

    const slots = planned.slots;
    const { prompt } = buildPlannerPrompt(ctx, slots);
    const reply = await task(
      "choose-content",
      async (track) => {
        const res = await ai.structured(plannerSchema, prompt, { system: batch ? PLANNER_SYSTEM + PLANNER_BATCH_NOTE : PLANNER_SYSTEM, model: MODELS.analyze });
        track(res.usage);
        return res.data;
      },
      (r) => `Chose the angle, offering and persona for ${r.slots.length} slots. Theme: ${r.theme}`
    );

    const placed = await task(
      "check-and-save",
      async () => {
        // Labels are rebuilt the same way, so they mean the same thing as in the prompt
        const items = mergePlan(ctx, slots, reply, buildPlannerPrompt(ctx, slots).labels);
        if (batch) return saveBatch(db(), items, ctx.timezone);
        const events = [...new Set(ctx.events.filter((e) => e.date >= weekStart).map((e) => e.name))];
        const ids = await savePlan(db(), plan.id, items, { theme: reply.theme, rationale: reply.rationale, mix: pillarMix(ctx, items), events });
        return ids.map((id) => ({ id, planId: plan.id }));
      },
      (r) => (batch ? `Saved ${r.length} post${r.length === 1 ? "" : "s"}: ${reply.theme}` : `Saved the plan with ${r.length} slots`)
    );

    await step.sendEvent(
      "start-production",
      placed.map(({ id, planId }) => ({ name: "plan-item/produce", id: `produce-${id}`, data: { businessId, itemId: id, planId, ...(batch ? { oneOff: true } : {}) } }))
    );
    return { planId: plan.id, items: placed.length };
  }
);
