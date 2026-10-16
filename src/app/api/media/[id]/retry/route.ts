import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { getMedia, markGenerating } from "@/core/media";
import { inngest } from "@/jobs/client";

export const POST = apiHandler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const db = await createClient();
  const media = await getMedia(db, id);

  if (media.type === "text") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Text posts can't be retried" } },
      { status: 400 }
    );
  }

  await markGenerating(db, id);

  const event = media.type === "video" ? "media/generate-video" : "media/generate-image";
  await inngest.send({ name: event, data: { mediaId: id }, id: `${id}-retry-${Date.now()}` });

  return NextResponse.json({ ok: true });
});
