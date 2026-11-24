import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { creditBalance } from "@/core/credits/ledger";

// GET /api/credits/balance: the business's credits (the sidebar), and a monthly fee still due
export const GET = apiHandler(async () => {
  const { businessId } = await currentBusiness();
  return NextResponse.json(await creditBalance(businessId));
});
