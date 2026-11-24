import { inngest } from "./client";
import { listActiveBusinessIds } from "@/lib/supabase/business";

// Scheduled work runs once per business: the cron only lists the businesses it's for and sends one
// event each; the function behind the event does the work with that business's database.

type PerBusinessEvent = "plan/check-due" | "performance/sync" | "performance/learn" | "brand/monthly-refresh" | "credits/monthly-fees";

/** `list` picks the businesses: every active one by default (the weekly plan passes only those that plan by themselves). */
export function cronForEveryBusiness(id: string, cron: string, event: PerBusinessEvent, list: () => Promise<string[]> = listActiveBusinessIds) {
  return inngest.createFunction({ id, retries: 2 }, { cron }, async ({ step }) => {
    const businessIds = await step.run("active-businesses", list);
    if (businessIds.length) {
      await step.sendEvent(
        "one-per-business",
        businessIds.map((businessId) => ({ name: event, data: { businessId } }))
      );
    }
    return { businesses: businessIds.length };
  });
}
