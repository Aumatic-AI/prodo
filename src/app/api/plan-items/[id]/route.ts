import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { editCaptions } from "@/core/plans/approval";
import { getItemView } from "@/core/plans/plans";

export const GET = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return NextResponse.json(await getItemView(await createClient(), id));
});

const patchSchema = z.object({ captions: z.record(z.string(), z.string().trim().min(1, "A caption can't be empty").max(63206)) });

// Edit captions before approving
export const PATCH = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { captions } = patchSchema.parse(await req.json());
  const db = await createClient();
  await editCaptions(db, id, captions);
  return NextResponse.json(await getItemView(db, id));
});
