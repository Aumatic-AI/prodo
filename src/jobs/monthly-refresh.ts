import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { startPartialRefresh } from "@/core/onboarding/research";
import { publicHolidays } from "@/providers/calendar/holidays";
import { addDays } from "@/lib/zoned-time";

// Once a month: public holidays for the client's countries become key dates (source system), and
// the Social & Market Analyst reads the market again (own posts, competitors, ads, hooks).
// Skipped while paused or before onboarding is done.

const LOOKAHEAD_DAYS = 120;

export const monthlyRefresh = inngest.createFunction(
  { id: "monthly-refresh", retries: 2 },
  { cron: "TZ=UTC 0 4 1 * *" },
  async ({ step }) => {
    const ready = await step.run("check", async () => {
      const db = createAdminClient();
      const [{ data: profile }, { data: settings }] = await Promise.all([
        db.from("business_profile").select("onboarding_status, countries").eq("id", 1).single(),
        db.from("app_settings").select("paused").eq("id", 1).single(),
      ]);
      if (profile?.onboarding_status !== "done" || settings?.paused) return null;
      return { countries: (profile.countries ?? []).slice(0, 3) as string[] };
    });
    if (!ready) return { skipped: true };

    const added = await step.run("public-holidays", async () => {
      const db = createAdminClient();
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

    const research = await step.run("start-market-refresh", () => startPartialRefresh(createAdminClient(), ["social_market_analyst"]));
    if (research) {
      await step.sendEvent("market-refresh", { name: "onboarding/started", id: research.attempt, data: { runId: research.id, attempt: research.attempt, agents: ["social_market_analyst"] } });
    }
    return { holidays: added, marketRefresh: !!research };
  }
);
