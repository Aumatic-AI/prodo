import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { getPost, updatePost, ownTargets, replacePostTargets, validateScheduleDate } from "@/core/posts";
import { inngest } from "@/jobs/client";

export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const body = await req.json();
  const action: "now" | "schedule" | "draft" = body.action || "now";

  const { db, businessId } = await currentBusiness();
  const post = await getPost(db, id);

  if (post.status !== "draft") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Only draft posts can be edited from here" } },
      { status: 400 }
    );
  }

  if (action === "schedule") {
    const scheduleError = body.publish_at ? validateScheduleDate(body.publish_at) : "publish_at is required to schedule";
    if (scheduleError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: scheduleError } }, { status: 400 });
    }
  }

  if (Array.isArray(body.targets)) {
    await replacePostTargets(db, id, await ownTargets(db, body.targets));
  }

  if (action === "draft") {
    return NextResponse.json({ ok: true });
  }

  await updatePost(db, id, {
    status: action === "schedule" ? "scheduled" : "draft",
    publish_at: action === "schedule" ? body.publish_at : null,
  });

  await inngest.send({ name: "post/publish", data: { businessId, postId: id } });

  return NextResponse.json({ ok: true });
});
