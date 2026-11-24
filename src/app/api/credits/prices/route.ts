import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { priceList } from "@/core/credits/prices";

// GET /api/credits/prices: what each action costs, for the hints on buttons
export const GET = apiHandler(async () => NextResponse.json(await priceList()));
