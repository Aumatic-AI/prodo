import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminHandler } from "@/core/admin/guard";
import { getBusinessDetail } from "@/core/admin/businesses";

// GET /api/admin/businesses/:id: one business: balance, this month and all-time use, top-ups
export const GET = adminHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const id = z.string().uuid().parse((await params).id);
  return NextResponse.json(await getBusinessDetail(id));
});
