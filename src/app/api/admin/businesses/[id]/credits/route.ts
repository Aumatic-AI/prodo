import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminHandler } from "@/core/admin/guard";
import { addCredits, creditsSchema } from "@/core/admin/businesses";

// POST /api/admin/businesses/:id/credits: add credits (with what was paid) or take some away
export const POST = adminHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }, admin) => {
  const id = z.string().uuid().parse((await params).id);
  const balance = await addCredits(admin, id, creditsSchema.parse(await req.json()));
  return NextResponse.json({ balance });
});
