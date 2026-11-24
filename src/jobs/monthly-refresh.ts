import { inngest } from "./client";
import { businessDb } from "@/lib/supabase/business";
import { startPartialRefresh } from "@/core/onboarding/research";
import { publicHolidays } from "@/providers/calendar/holidays";
import { addDays } from "@/lib/zoned-time";
import { cronForEveryBusiness } from "./every-business";
import { refundCredits, spendCredits } from "@/core/credits/ledger";
import { classify } from "@/core/errors";

// Once a month, for each business: public holidays for its countries become key dates (source
// system), and the Social & Market Analyst reads its market again (own posts, competitors, ads, hooks).
// Skipped while paused or before onboarding is done. The market refresh takes its credits for the month; without
// enough it waits for next month (the key dates are free).

const LOOKAHEAD_DAYS = 120;

/** The 1st of every month at 04:00 UTC, for each business */
export const monthlyRefreshCron = cronForEveryBusiness("monthly-refresh-cron", "TZ=UTC 0 4 1 * *", "brand/monthly-refresh");

export const monthlyRefresh = inngest.createFunction(
  { id: "monthly-refresh", retries: 2, concurrency: [{ limit: 1, key: "event.data.businessId" }] },
  { event: "brand/monthly-refresh" },
  async ({ event, step }) => {
    const { businessId } = event.data;
    const ready = await step.run("check", async () => {
      const db = businessDb(businessId);
      const [{ data: profile }, { data: settings }] = await Promise.all([
        db.from("business_profile").select("onboarding_status, countries").single(),
        db.from("app_settings").select("paused").single(),
      ]);
      if (profile?.onboarding_status !== "done" || settings?.paused) return null;
      return { countries: (profile.countries ?? []).slice(0, 3) as string[] };
    });
    if (!ready) return { skipped: true };

    const added = await step.run("public-holidays", async () => {
      const db = businessDb(businessId);
      const today = new Date().toISOString().slice(0, 10);
      const until = addDays(today, LOOKAHEAD_DAYS);
      const years = [...new Set([today.slice(0, 4), until.slice(0, 4)].map(Number))];
      const found = (await Promise.all(ready.countries.flatMap((c) => years.map((y) => publicHolidays(c, y))))).flat().filter((h) => h.date >= today && h.date <= until);
      const { data: existing } = await db.from("calendar_events").select("date, name").gte("date", today).lte("date", until);
      const seen = new Set((existing ?? []).map((e) => `${e.date}|${e.name.toLowerCase()}`));
      const rows = found
        .filter((h) => !seen.has(`${h.date}|${h.name.toLowerCase()}`) && (seen.add(`${h.date}|${h.name.toLowerCase()}`), true))
        .map((h) => ({ date: h.date, name: h.name, kind: "holiday", relevance: 3, source: "system", notes: `Public holiday (${h.countryCode})` }));
      if (rows.length) {
        const { error } = await db.from("calendar_events").insert(rows);
        if (error) throw error;
      }
      return rows.length;
    });

    const research = await step.run("start-market-refresh", async () => {
      const key = `market:${new Date().toISOString().slice(0, 7)}`;
      try {
        await spendCredits(businessId, { action: "market_refresh", label: "Monthly market refresh", key }, "The monthly market refresh");
      } catch (err) {
        if (classify(err).type === "NO_CREDITS") return null;
        throw err;
      }
      const started = await startPartialRefresh(businessDb(businessId), ["social_market_analyst"]);
      // Nothing started (one is already running): its credits go back
      if (!started) await refundCredits(businessId, key);
      return started;
    });
    if (research) {
      await step.sendEvent("market-refresh", { name: "onboarding/started", id: research.attempt, data: { businessId, runId: research.id, attempt: research.attempt, agents: ["social_market_analyst"] } });
    }
    return { holidays: added, marketRefresh: !!research };
  }
);
