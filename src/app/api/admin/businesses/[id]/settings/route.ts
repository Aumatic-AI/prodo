import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminHandler } from "@/core/admin/guard";
import { setBudget, settingsSchema } from "@/core/admin/businesses";

// PUT /api/admin/businesses/:id/settings: the monthly AI safety cap
export const PUT = adminHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const id = z.string().uuid().parse((await params).id);
  await setBudget(id, settingsSchema.parse(await req.json()).budgetUsd);
  return NextResponse.json({ ok: true });
});
