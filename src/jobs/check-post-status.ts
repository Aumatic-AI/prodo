import { inngest } from "./client";
import { businessDb } from "@/lib/supabase/business";
import { getPost, updatePost } from "@/core/posts";
import { notify } from "@/core/notifications/notify";
import { publisherFor } from "@/providers/publishing/registry";

/** Sleeps until the post is due, then polls the provider for each target's real outcome and live URL. */
export const checkPostStatus = inngest.createFunction(
  { id: "check-post-status", cancelOn: [{ event: "post/cancelled", if: "event.data.postId == async.data.postId && event.data.businessId == async.data.businessId" }] },
  { event: "post/check-status" },
  async ({ event, step }) => {
    const { businessId } = event.data;
    const db = businessDb(businessId);

    await step.sleepUntil("wait-until-due", event.data.checkAt);

    const MAX_ATTEMPTS = 10; // 30s apart => up to 5 minutes of checking after the due time
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const resolved = await step.run(`check-${attempt}`, async () => {
        const post = await getPost(db, event.data.postId);
        const pending = post.post_targets.filter((t) => t.status === "pending" && t.provider_ref);
        if (!pending.length) return true;

        for (const target of pending) {
          const publisher = publisherFor(target.provider);
          const status = await publisher.getStatus(target.provider_ref!, target.platform);

          if (status.status === "completed") {
            await db
              .from("post_targets")
              .update({
                status: "published",
                url: status.url || target.url,
                provider_post_id: status.providerPostId ?? null,
                published_at: status.publishedAt ?? new Date().toISOString(),
              })
              .eq("id", target.id);
          } else if (status.status === "failed") {
            await db
              .from("post_targets")
              .update({ status: "failed", error: status.error || "Publishing failed" })
              .eq("id", target.id);
          }
        }

        const { data: targets } = await db.from("post_targets").select("status").eq("post_id", event.data.postId);
        return targets?.every((t: any) => t.status === "published" || t.status === "failed") ?? false;
      });

      if (resolved) break;
      if (attempt < MAX_ATTEMPTS - 1) await step.sleep(`wait-${attempt}`, "30s");
    }

    await step.run("resolve-status", async () => {
      const { data: targets } = await db.from("post_targets").select("status").eq("post_id", event.data.postId);
      const allPublished = targets?.every((t: any) => t.status === "published");
      const allFailed = targets?.every((t: any) => t.status === "failed");
      const finalStatus = allPublished ? "published" : allFailed ? "failed" : "partial";
      await updatePost(db, event.data.postId, { status: finalStatus });

      // A post the Publisher made: its plan slot follows, and a failure is reported
      const { data: post } = await db.from("posts").select("plan_item_id").eq("id", event.data.postId).single();
      if (post?.plan_item_id) {
        await db
          .from("plan_items")
          .update({ status: allFailed ? "failed" : "published", error: allFailed ? "Publishing failed on every account. Open the post for details." : null })
          .eq("id", post.plan_item_id);
      }
      if (finalStatus !== "published") {
        await notify(db, {
          kind: "post_failed",
          title: allFailed ? "A post couldn't be published" : "A post was only partly published",
          body: "Open it in Posts to see which account failed and why.",
          link: `/posts/${event.data.postId}`,
          email: true,
        });
      }
    });

    return { postId: event.data.postId };
  }
);
