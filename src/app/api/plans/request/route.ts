import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors";
import { findPlanByWeek } from "@/core/plans/plans";
import { resolveWeek, weekClock } from "@/core/plans/week";
import { addDays } from "@/lib/zoned-time";
import { inngest } from "@/jobs/client";

const schema = z.object({ week: z.string().default("next"), replace: z.boolean().default(false) });

// "Plan next week" / "Plan again": starts the Planner for that week
export const POST = apiHandler(async (req: NextRequest) => {
  const { week, replace } = schema.parse(await req.json().catch(() => ({})));
  const db = await createClient();
  const clock = await weekClock(db);
  const weekStart = resolveWeek(week, clock);
  if (weekStart < clock.thisWeek) throw new AppError("That week is over. Plan this week or a later one.", "INVALID_INPUT", false);
  // Slots start tomorrow, so on the week's last day there's nothing left to plan
  if (weekStart === clock.thisWeek && clock.today >= addDays(clock.thisWeek, 6)) {
    throw new AppError("Today is the last day of this week. Plan next week instead.", "INVALID_INPUT", false);
  }

  const existing = await findPlanByWeek(db, weekStart);
  if (existing && !replace && existing.status !== "failed" && !existing.strategy?.adhoc) {
    throw new AppError("This week already has a plan. Use Plan again to replace it.", "INVALID_INPUT", false);
  }
  if (existing && ["planning", "producing"].includes(existing.status) && replace) {
    throw new AppError("The agents are still working on this week. Wait until they finish, then plan again.", "INVALID_INPUT", false);
  }
  await inngest.send({ name: "plan/requested", id: `plan-${weekStart}-${replace ? "again" : "new"}-${Math.floor(Date.now() / 60_000)}`, data: { weekStart, replace, source: "client" } });
  return NextResponse.json({ weekStart, started: true });
});
