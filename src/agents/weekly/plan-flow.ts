import { inngest } from "@/jobs/client";
import { approvePlan } from "@/core/plans/approval";
import { getPlan, listItems, setPlanStatus } from "@/core/plans/plans";
import { SETTLED } from "@/core/plans/types";
import { notify } from "@/core/notifications/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { nextWeekStart, safeZone, zonedParts } from "@/lib/zoned-time";

// The weekly loop around the agents:
// - weekly cron: on the client's plan day and time, plan next week (Planner)
// - when every slot of a plan has settled: plan → review, tell the client
// - full autopilot: approve by itself after the timeout (slots that need review never go out)

/** Runs hourly; plans next week when it's the client's plan day and hour in their time zone. */
export const weeklyPlanCron = inngest.createFunction(
  { id: "weekly-plan-cron" },
  { cron: "TZ=UTC 0 * * * *" },
  async ({ step }) => {
    const due = await step.run("is-it-plan-time", async () => {
      const db = createAdminClient();
      const [{ data: settings }, { data: profile }, { data: bible }] = await Promise.all([
        db.from("app_settings").select("paused, plan_weekday, plan_time").eq("id", 1).single(),
        db.from("business_profile").select("timezone, onboarding_status").eq("id", 1).single(),
        db.from("brand_bible").select("id").eq("status", "approved").maybeSingle(),
      ]);
      if (!settings || settings.paused || profile?.onboarding_status !== "done" || !bible) return null;
      const now = zonedParts(new Date(), safeZone(profile.timezone));
      const planHour = Number(String(settings.plan_time).slice(0, 2));
      if (now.weekday !== settings.plan_weekday || now.hour !== planHour) return null;
      const weekStart = nextWeekStart(now.day);
      const { data: existing } = await db.from("content_plans").select("id, status, strategy").eq("week_start", weekStart).maybeSingle();
      // A week holding only single ads still gets its plan
      return existing && existing.status !== "failed" && !existing.strategy?.adhoc ? null : weekStart;
    });
    if (!due) return { planned: false };
    // Event id = week: a retry or a second run in the same hour plans once
    await step.sendEvent("request-plan", { name: "plan/requested", id: `plan-${due}`, data: { weekStart: due, source: "cron" } });
    return { planned: true, weekStart: due };
  }
);

/** The first approved Brand Bible plans the first week straight away (later approvals don't). */
export const firstPlan = inngest.createFunction(
  { id: "first-plan-after-bible" },
  { event: "brand/approved" },
  async ({ step }) => {
    const weekStart = await step.run("first-time", async () => {
      const db = createAdminClient();
      const [{ count }, { data: profile }, { data: settings }] = await Promise.all([
        db.from("content_plans").select("id", { count: "exact", head: true }),
        db.from("business_profile").select("timezone").eq("id", 1).single(),
        db.from("app_settings").select("paused").eq("id", 1).single(),
      ]);
      if (count || settings?.paused) return null;
      return nextWeekStart(zonedParts(new Date(), safeZone(profile?.timezone)).day);
    });
    if (!weekStart) return { planned: false };
    await step.sendEvent("request-plan", { name: "plan/requested", id: `plan-${weekStart}`, data: { weekStart, source: "onboarding" } });
    return { planned: true, weekStart };
  }
);

/** After each slot settles: is the whole plan done? */
export const onItemSettled = inngest.createFunction(
  { id: "plan-item-settled", concurrency: [{ limit: 1, key: "event.data.planId" }] },
  { event: "plan-item/settled" },
  async ({ event, step }) => {
    const { planId, itemId, oneOff } = event.data;
    const db = () => createAdminClient();

    if (oneOff) {
      await step.run("tell-client", async () => {
        const { data: item } = await db().from("plan_items").select("status, angle").eq("id", itemId).single();
        const ok = item?.status === "ready";
        await notify(db(), {
          kind: ok ? "ad_ready" : "item_needs_review",
          title: ok ? "Your new ad is ready to approve" : "Your new ad needs a look",
          body: ok ? `"${item?.angle}" passed both quality checks.` : `"${item?.angle}" didn't pass the quality checks. Open it to see why.`,
          link: `/week?item=${itemId}`,
          email: false,
        });
        // A week of single ads only: once they are all made, it waits for the client like a plan
        const plan = await getPlan(db(), planId);
        if (plan.strategy?.adhoc && plan.status === "producing") {
          const items = await listItems(db(), planId);
          if (items.every((i) => SETTLED.includes(i.status))) await setPlanStatus(db(), planId, "review");
        }
      });
      return { oneOff: true };
    }

    const done = await step.run("check-plan", async () => {
      const plan = await getPlan(db(), planId);
      if (plan.status !== "producing") return null;
      const items = await listItems(db(), planId);
      if (!items.every((i) => SETTLED.includes(i.status))) return null;

      const { data: settings } = await db().from("app_settings").select("autopilot_mode, approval_timeout_hours").eq("id", 1).single();
      const full = settings?.autopilot_mode === "full";
      const due = full ? new Date(Date.now() + (settings?.approval_timeout_hours ?? 24) * 3600_000).toISOString() : null;
      await setPlanStatus(db(), planId, "review", { approval_due_at: due });

      const ready = items.filter((i) => i.status === "ready").length;
      const review = items.filter((i) => i.status === "needs_review" || i.status === "failed").length;
      await notify(db(), {
        kind: "plan_ready",
        title: `Your plan for the week of ${plan.week_start} is ready`,
        body: [
          `${ready} of ${items.length} posts passed both quality checks${review ? `, ${review} need your look` : ""}.`,
          full ? `On full autopilot, the ready posts are approved by themselves in ${settings?.approval_timeout_hours ?? 24} hours unless you change something.` : "Approve the plan to schedule them.",
        ].join("\n\n"),
        link: "/week",
        email: true,
        actionLabel: "Review the plan",
      });
      return { full };
    });

    if (done) await step.sendEvent("review-started", { name: "plan/review-started", data: { planId } });
    return { reviewed: !!done };
  }
);

/** Full autopilot: when the timeout passes and the plan is still waiting, approve it. */
export const autoApprove = inngest.createFunction(
  { id: "plan-auto-approve", cancelOn: [{ event: "plan/approved", match: "data.planId" }] },
  { event: "plan/review-started" },
  async ({ event, step }) => {
    const { planId } = event.data;
    const db = () => createAdminClient();
    const due = await step.run("when", async () => (await getPlan(db(), planId)).approval_due_at);
    if (!due) return { auto: false };

    await step.sleepUntil("wait-for-client", due);

    const approved = await step.run("approve-if-still-waiting", async () => {
      const [plan, { data: settings }] = await Promise.all([getPlan(db(), planId), db().from("app_settings").select("autopilot_mode, paused").eq("id", 1).single()]);
      if (plan.status !== "review" || settings?.autopilot_mode !== "full" || settings?.paused) return false;
      await approvePlan(db(), planId);
      return true;
    });
    if (approved) await step.sendEvent("approved", { name: "plan/approved", data: { planId, auto: true } });
    return { auto: approved };
  }
);
