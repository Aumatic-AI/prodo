import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { getPost, cancelPost } from "@/core/posts";
import { publisherFor } from "@/providers/publishing/registry";
import { inngest } from "@/jobs/client";

export const POST = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { db, businessId } = await currentBusiness();
  const post = await getPost(db, id);

  if (post.status !== "scheduled") {
    return NextResponse.json(
      { error: { code: "VALIDATION_ERROR", message: "Only scheduled posts can be cancelled" } },
      { status: 400 }
    );
  }

  for (const target of post.post_targets) {
    if (!target.provider_ref) continue;
    try {
      const publisher = publisherFor(target.provider);
      await publisher.cancelScheduled(target.provider_ref);
    } catch (e) {
      // Best-effort — the job may already have fired or no longer exist
      // upstream. Our own rows still get reverted to draft below either way.
      console.error(`[CANCEL_POST_${id}_${target.id}]`, e);
    }
  }

  await cancelPost(db, id);

  // A post from the plan: the slot goes back to approved, ready to schedule again from This week
  if (post.plan_item_id) {
    await db.from("plan_items").update({ status: "approved", error: "Schedule cancelled in Posts" }).eq("id", post.plan_item_id);
    await db.from("posts").delete().eq("id", id);
  }

  // Cancels the dangling check-post-status run (it's sleeping until the
  // original publish_at) so it can't wake later and overwrite this post's
  // now-reverted draft status based on stale target state.
  await inngest.send({ name: "post/cancelled", data: { businessId, postId: id } });

  return NextResponse.json({ ok: true });
});
