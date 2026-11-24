import { NextResponse, type NextRequest } from "next/server";
import { adminHandler } from "@/core/admin/guard";
import { AppError } from "@/core/errors";
import { loadUsage } from "@/core/admin/overview";

// GET /api/admin/usage?month=YYYY-MM: credits each business used that month, by kind of work
export const GET = adminHandler(async (req: NextRequest) => {
  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new AppError("Pick a month like 2026-10.", "INVALID_INPUT", false);
  return NextResponse.json(await loadUsage(month));
});
