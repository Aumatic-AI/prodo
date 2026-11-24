import { NextResponse, type NextRequest } from "next/server";
import { adminHandler } from "@/core/admin/guard";
import { createBusinessLogin, listBusinesses, newBusinessSchema } from "@/core/admin/businesses";

// GET /api/admin/businesses: every business with its login, balance and use
export const GET = adminHandler(async () => NextResponse.json(await listBusinesses()));

// POST /api/admin/businesses: a new business (its login and first credits)
export const POST = adminHandler(async (req: NextRequest, _ctx, admin) => {
  const input = newBusinessSchema.parse(await req.json());
  return NextResponse.json(await createBusinessLogin(admin, input), { status: 201 });
});
