import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { deleteMedia } from "@/core/media";
import { inngest } from "@/jobs/client";

export const DELETE = apiHandler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const db = await createClient();
  await deleteMedia(db, id);
  await inngest.send({ name: "media/deleted", data: { mediaId: id } });
  return NextResponse.json({ ok: true });
});
