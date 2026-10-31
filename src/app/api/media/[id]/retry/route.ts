import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { getMedia, markGenerating, startGenerating } from "@/core/media";
import { assertVideoReady } from "@/providers/ffmpeg/client";
import { restartItem } from "@/core/plans/approval";

export const POST = apiHandler(async (_req, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { db, businessId } = await currentBusiness();
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
    const item = await restartItem(db, businessId, media.plan_item_id, null);
    return NextResponse.json({ ok: true, planItemId: item.id });
  }

  await markGenerating(db, id);

  await startGenerating(db, businessId, media, `${id}-retry-${Date.now()}`);

  return NextResponse.json({ ok: true });
});
