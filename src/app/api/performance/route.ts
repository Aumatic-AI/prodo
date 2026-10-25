import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { loadPerformanceView } from "@/core/performance/dashboard";

const RANGES = [7, 30, 90];

// GET /api/performance?days=7|30|90: results, followers, best posts, learnings and the latest weekly report
export const GET = apiHandler(async (req: NextRequest) => {
  const days = Number(req.nextUrl.searchParams.get("days") ?? 30);
  return NextResponse.json(await loadPerformanceView(await createClient(), RANGES.includes(days) ? days : 30));
});
