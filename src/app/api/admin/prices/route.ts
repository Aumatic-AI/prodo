import { NextResponse, type NextRequest } from "next/server";
import { adminHandler } from "@/core/admin/guard";
import { priceList } from "@/core/credits/prices";
import { pricesSchema, savePrices } from "@/core/admin/prices";

// GET /api/admin/prices: credits per action. PUT: change them
export const GET = adminHandler(async () => NextResponse.json(await priceList()));
export const PUT = adminHandler(async (req: NextRequest) => NextResponse.json(await savePrices(pricesSchema.parse(await req.json()))));
