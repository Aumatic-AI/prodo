import { NextResponse } from "next/server";
import { adminHandler } from "@/core/admin/guard";
import { loadDashboard } from "@/core/admin/overview";

// GET /api/admin/dashboard: money in, credits used, our AI cost and who needs credits
export const GET = adminHandler(async () => NextResponse.json(await loadDashboard()));
