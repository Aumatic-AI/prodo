import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { getMedia, markGenerating } from "@/core/media";
import { inngest } from "@/jobs/client";
import { assertVideoReady } from "@/providers/ffmpeg/client";
import { regenerateItem } from "@/core/plans/approval";

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

  if (media.type === "video") await assertVideoReady();

  // Made by the agents for a planned post: run the whole agent chain again for that post (the same as
  // Try again on This week), so the post and its media stay in step
  if (media.plan_item_id) {
    const item = await regenerateItem(db, media.plan_item_id, null);
    await inngest.send({ name: "plan-item/produce", id: `produce-${item.id}-${Date.now()}`, data: { itemId: item.id, planId: item.plan_id, note: null } });
    return NextResponse.json({ ok: true, planItemId: item.id });
  }

  await markGenerating(db, id);

  const event = media.type === "video" ? "media/generate-video" : "media/generate-image";
  await inngest.send({ name: event, data: { mediaId: id }, id: `${id}-retry-${Date.now()}` });

  return NextResponse.json({ ok: true });
});
