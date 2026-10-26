import { inngest } from "@/jobs/client";
import { userMessage } from "@/core/errors";
import { notify } from "@/core/notifications/notify";
import { getItem, getPlan, setPlanStatus, updateItem } from "@/core/plans/plans";
import { businessDb } from "@/lib/supabase/business";
import { publisherFor } from "@/providers/publishing/registry";
import { optional } from "@/agents/run";
import { taskFor } from "@/agents/weekly/task";
import { scheduleItem, type Scheduled } from "./schedule";

// Agent 9 · Publisher
// After approval (the client's, or full autopilot's after the timeout) every approved slot becomes a
// scheduled post on Zernio; publish-post and check-post-status take it from there. Paused or over
// budget stops it (agentStep checks both). Never posts anything that wasn't approved.

/** Plan approved: schedule all its approved slots. */
export const publishPlan = inngest.createFunction(
  { id: "agent-publisher-plan", retries: 2, concurrency: [{ limit: 1, key: "event.data.planId" }] },
  { event: "plan/approved" },
  async ({ event, step }) => {
    const { businessId, planId } = event.data;
    const db = () => businessDb(businessId);
    const task = taskFor(step, "publisher", { businessId, planId });

    const itemIds = await step.run("approved-slots", async () => {
      const { data, error } = await db().from("plan_items").select("id").eq("plan_id", planId).eq("status", "approved").order("slot_at");
      if (error) throw error;
      return (data ?? []).map((r) => r.id);
    });
    if (!itemIds.length) return { scheduled: 0 };

    const accounts = await task("read-accounts", () => publisherFor().listAccounts(db()), (r) => `Found ${r.length} connected accounts`);

    const results: (Scheduled | null)[] = [];
    for (const itemId of itemIds) {
      const one = taskFor(step, "publisher", { businessId, planId, itemId });
      const res = await optional(
        one(
          `schedule-${itemId}`,
          async () => {
            try {
              return await scheduleItem(db(), itemId, accounts);
            } catch (err) {
              // Keep the slot approved with the reason, so the client can fix it and schedule again
              await updateItem(db(), itemId, { error: userMessage(err) });
              throw err;
            }
          },
          (r) => `Scheduled for ${new Date(r.publishAt!).toUTCString().slice(0, 22)} on ${r.platforms.join(", ")}`
        )
      );
      results.push(res);
      if (res?.postId) await step.sendEvent(`publish-${itemId}`, { name: "post/publish", id: `post-${res.postId}`, data: { businessId, postId: res.postId } });
    }

    const scheduled = results.filter((r) => r?.postId).length;
    await step.run("finish", async () => {
      if (scheduled) await setPlanStatus(db(), planId, "scheduled");
      const plan = await getPlan(db(), planId);
      const failed = itemIds.length - scheduled;
      await notify(db(), {
        kind: "plan_scheduled",
        title: scheduled ? `${scheduled} posts scheduled for the week of ${plan.week_start}` : "Nothing could be scheduled",
        body: failed ? `${failed} couldn't be scheduled. Open This week to see why.` : "They'll go out at the planned times. You can still cancel any of them in Posts.",
        link: "/week",
        email: true,
      });
    });
    return { scheduled };
  }
);

/** One slot approved on its own: schedule it now. */
export const publishItem = inngest.createFunction(
  { id: "agent-publisher-item", retries: 2, concurrency: [{ limit: 1, key: "event.data.itemId" }] },
  { event: "plan-item/approved" },
  async ({ event, step }) => {
    const { businessId, itemId } = event.data;
    const db = () => businessDb(businessId);
    const item = await step.run("load-slot", () => getItem(db(), itemId));
    const task = taskFor(step, "publisher", { businessId, planId: item.plan_id, itemId });

    const res = await task(
      "schedule",
      async () => {
        try {
          return await scheduleItem(db(), itemId);
        } catch (err) {
          await updateItem(db(), itemId, { error: userMessage(err) });
          throw err;
        }
      },
      (r) => `Scheduled for ${new Date(r.publishAt!).toUTCString().slice(0, 22)} on ${r.platforms.join(", ")}`
    );
    if (res.postId) await step.sendEvent("publish", { name: "post/publish", id: `post-${res.postId}`, data: { businessId, postId: res.postId } });
    return res;
  }
);
