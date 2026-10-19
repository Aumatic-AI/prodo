import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPost, updatePost } from "@/core/posts";
import { publisherFor } from "@/providers/publishing/registry";

/**
 * Upload-Post can fire a scheduled post itself, and can also background-
 * process an "immediate" one (Instagram especially) — either way, publishPost
 * has already moved on by the time the real outcome is known. This closes
 * the loop: sleeps at zero cost until checkAt (the scheduled time, or ~now
 * for an immediate publish), then polls Upload-Post a handful of times to
 * find the real success/fail outcome and the live post URL.
 */
export const checkPostStatus = inngest.createFunction(
  { id: "check-post-status" },
  { event: "post/check-status" },
  async ({ event, step }) => {
    const db = createAdminClient();

    await step.sleepUntil("wait-until-due", event.data.checkAt);

    const MAX_ATTEMPTS = 10; // 30s apart => up to 5 minutes of checking after the due time
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const resolved = await step.run(`check-${attempt}`, async () => {
        const post = await getPost(db, event.data.postId);
        const pending = post.post_targets.filter((t) => t.status === "pending" && t.provider_ref);
        if (!pending.length) return true;

        for (const target of pending) {
          const publisher = publisherFor(target.provider);
          const status = await publisher.getStatus(target.provider_ref!);

          if (status.status === "completed") {
            await db
              .from("post_targets")
              .update({ status: "published", url: status.url || target.url })
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
    });

    return { postId: event.data.postId };
  }
);
