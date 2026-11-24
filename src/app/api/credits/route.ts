import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { AppError } from "@/core/errors";
import { loadCredits } from "@/core/credits/view";

// GET /api/credits?month=YYYY-MM (UTC month, default this one): the balance, the month's use and every change
export const GET = apiHandler(async (req: NextRequest) => {
  const month = req.nextUrl.searchParams.get("month") ?? new Date().toISOString().slice(0, 7);
  if (!/^\d{4}-\d{2}$/.test(month)) throw new AppError("Pick a month like 2026-10.", "INVALID_INPUT", false);
  const { db, businessId } = await currentBusiness();
  return NextResponse.json(await loadCredits(db, businessId, month));
});
