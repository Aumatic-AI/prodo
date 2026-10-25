import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { findPlanByWeek, loadPlanView } from "@/core/plans/plans";
import { resolveWeek, weekClock } from "@/core/plans/week";

// GET /api/plans?week=this|next|YYYY-MM-DD → that week's plan with its slots (or null), and the clock
export const GET = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const clock = await weekClock(db);
  const weekStart = resolveWeek(req.nextUrl.searchParams.get("week"), clock);
  const plan = await findPlanByWeek(db, weekStart);
  return NextResponse.json({ weekStart, clock, plan: plan ? await loadPlanView(db, plan) : null });
});
