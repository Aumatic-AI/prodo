import { inngest } from "./client";
import { cronForEveryBusiness } from "./every-business";
import { chargeAccountFee, connectedAccountCount } from "@/core/credits/fees";

// On the 1st of every month, each business pays credits for its connected social accounts (credit_prices
// "social_account", per account). Without enough credits the fee waits as due and publishing pauses until
// the admin adds credits (core/credits/fees.ts).

/** The 1st of every month at 03:00 UTC, for each business */
export const monthlyFeesCron = cronForEveryBusiness("monthly-fees-cron", "TZ=UTC 0 3 1 * *", "credits/monthly-fees");

export const monthlyFees = inngest.createFunction(
  { id: "monthly-fees", retries: 2, concurrency: [{ limit: 1, key: "event.data.businessId" }] },
  { event: "credits/monthly-fees" },
  async ({ event, step }) => {
    const { businessId } = event.data;
    // The month is read once, so a retry after midnight still charges the month it started for
    const month = await step.run("month", () => new Date().toISOString().slice(0, 7));
    const accounts = await step.run("count-accounts", () => connectedAccountCount(businessId));
    if (!accounts) return { accounts: 0 };
    const result = await step.run("take-fee", () => chargeAccountFee(businessId, accounts, month));
    return { accounts, ...result };
  }
);
