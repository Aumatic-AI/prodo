import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { adminHandler } from "@/core/admin/guard";
import { passwordSchema, setPassword } from "@/core/admin/businesses";

// POST /api/admin/businesses/:id/password: a new password for the business's own login
export const POST = adminHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const id = z.string().uuid().parse((await params).id);
  await setPassword(id, passwordSchema.parse(await req.json()).password);
  return NextResponse.json({ ok: true });
});
