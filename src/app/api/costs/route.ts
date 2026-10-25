import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors";
import { loadCosts } from "@/core/performance/costs";

// GET /api/costs?month=YYYY-MM (UTC month, default this one): agent spend by agent, day, asset and week
export const GET = apiHandler(async (req: NextRequest) => {
  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new AppError("Pick a month like 2026-10.", "INVALID_INPUT", false);
  return NextResponse.json(await loadCosts(await createClient(), month));
});
