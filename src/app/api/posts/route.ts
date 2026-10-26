import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { currentBusiness } from "@/core/business";
import { listPosts, createPost, ownTargets, validateScheduleDate } from "@/core/posts";
import { inngest } from "@/jobs/client";

export const GET = apiHandler(async () => {
  const db = await createClient();
  const posts = await listPosts(db);
  return NextResponse.json(posts);
});

export const POST = apiHandler(async (req: NextRequest) => {
  const { db, businessId } = await currentBusiness();
  const body = await req.json();

  const action: "now" | "schedule" | "draft" = body.action || "now";

  if (action === "schedule") {
    const scheduleError = body.publish_at ? validateScheduleDate(body.publish_at) : "publish_at is required to schedule";
    if (scheduleError) {
      return NextResponse.json({ error: { code: "VALIDATION_ERROR", message: scheduleError } }, { status: 400 });
    }
  }

  const post = await createPost(db, {
    media_id: body.media_id,
    status: action === "schedule" ? "scheduled" : "draft",
    publish_at: action === "schedule" ? body.publish_at || null : null,
    targets: await ownTargets(db, body.targets),
  });

  if (action !== "draft") {
    await inngest.send({
      name: "post/publish",
      data: { businessId, postId: post.id },
      id: post.id,
    });
  }

  return NextResponse.json(post, { status: 201 });
});
