import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPost, updatePost } from "@/core/posts";
import { publisherFor } from "@/providers/publishing/registry";
import { urlFor } from "@/providers/storage/supabase-storage";
import type { SupabaseClient } from "@supabase/supabase-js";

async function slideUrls(db: SupabaseClient, mediaId: string): Promise<string[]> {
  const { data } = await db
    .from("media_files")
    .select("storage_key")
    .eq("media_id", mediaId)
    .eq("role", "slide")
    .order("position");
  return (data ?? []).map((f) => urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, f.storage_key));
}

export const publishPost = inngest.createFunction(
  {
    id: "publish-post",
    retries: 3,
    concurrency: [{ limit: 1, key: "event.data.postId" }],
    onFailure: async ({ event }) => {
      const db = createAdminClient();
      const postId = event.data.event.data.postId;
      const msg = event.data.error?.message || "Publishing failed";
      await db.from("posts").update({ status: "failed" }).eq("id", postId);
      await db
        .from("post_targets")
        .update({ status: "failed", error: msg })
        .eq("post_id", postId)
        .eq("status", "pending");
    },
  },
  { event: "post/publish" },
  async ({ event, step }) => {
    const db = createAdminClient();
    const post = await step.run("load-post", () => getPost(db, event.data.postId));

    const isScheduled = !!post.publish_at && new Date(post.publish_at).getTime() > Date.now();

    if (!isScheduled) {
      await step.run("set-publishing", () => updatePost(db, post.id, { status: "publishing" }));
    }

    const media = await step.run("load-media", async () => {
      const { data } = await db.from("media").select("*").eq("id", post.media_id).single();
      return data;
    });

    const isText = media?.type === "text";
    if (!isText && !media?.storage_key) {
      await updatePost(db, post.id, { status: "failed" });
      return;
    }

    const mediaUrl = media?.storage_key
      ? urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, media.storage_key)
      : null;

    // Submit every target. Upload-Post can background-process even an
    // "immediate" publish (Instagram especially), so a successful submission
    // here only means "accepted" — it stays "pending" until the follow-up
    // check job below confirms the real outcome and captures the live URL.
    for (const target of post.post_targets) {
      await step.run(`publish-${target.id}`, async () => {
        try {
          await db.from("post_targets").update({ status: "sending" }).eq("id", target.id);

          const publisher = publisherFor(target.provider);
          const base = {
            platform: target.platform,
            accountId: target.account_id,
            caption: target.caption || media?.content || "",
            scheduledDate: isScheduled ? post.publish_at! : undefined,
          };

          let result;
          if (isText) {
            result = await publisher.publishText(base);
          } else if (media!.type === "video") {
            result = await publisher.publishVideo({ ...base, videoUrl: mediaUrl! });
          } else if (media!.type === "carousel" && publisher.publishCarousel) {
            result = await publisher.publishCarousel({ ...base, imageUrls: await slideUrls(db, media!.id) });
          } else {
            result = await publisher.publishPhoto({ ...base, imageUrl: mediaUrl! });
          }

          if (result.success) {
            await db
              .from("post_targets")
              .update({ status: "pending", provider_ref: result.providerRef, url: result.url })
              .eq("id", target.id);
          } else {
            await db
              .from("post_targets")
              .update({ status: "failed", error: result.error || "Publishing failed" })
              .eq("id", target.id);
          }
        } catch (err) {
          await db
            .from("post_targets")
            .update({ status: "failed", error: err instanceof Error ? err.message : "Unknown error" })
            .eq("id", target.id);
        }
      });
    }

    const allFailed = await step.run("resolve-status", async () => {
      const { data: targets } = await db.from("post_targets").select("status").eq("post_id", post.id);
      const failed = targets?.every((t: any) => t.status === "failed") ?? false;
      await updatePost(db, post.id, { status: failed ? "failed" : isScheduled ? "scheduled" : "publishing" });
      return failed;
    });

    if (allFailed) return;

    await step.sendEvent("queue-status-check", {
      name: "post/check-status",
      data: { postId: post.id, checkAt: isScheduled ? post.publish_at! : new Date().toISOString() },
    });
  }
);
