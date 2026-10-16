import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getPost, updatePost } from "@/core/posts";
import { publisherFor } from "@/providers/publishing/registry";
import { urlFor } from "@/providers/storage/supabase-storage";
import { toInngestError } from "./to-inngest-error";

export const publishPost = inngest.createFunction(
  {
    id: "publish-post",
    retries: 3,
    concurrency: [{ limit: 1, key: "event.data.postId" }],
    cancelOn: [{ event: "post/deleted", match: "data.postId" }],
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

    await step.run("set-publishing", () => updatePost(db, post.id, { status: "publishing" }));

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

    for (const target of post.post_targets) {
      await step.run(`publish-${target.id}`, async () => {
        try {
          await db.from("post_targets").update({ status: "sending" }).eq("id", target.id);

          const publisher = publisherFor(target.provider);

          let result;
          if (isText) {
            result = await publisher.publishText({
              caption: target.caption || media?.content || "",
              accountId: target.account_id,
            });
          } else {
            const method = media!.type === "video" ? "publishVideo" : "publishPhoto";
            result = await publisher[method]({
              [media!.type === "video" ? "videoUrl" : "imageUrl"]: mediaUrl!,
              caption: target.caption,
              accountId: target.account_id,
            } as any);
          }

          if (result.success) {
            await db
              .from("post_targets")
              .update({ status: "published", provider_ref: result.providerRef, url: result.url })
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

    await step.run("resolve-status", async () => {
      const { data: targets } = await db
        .from("post_targets")
        .select("status")
        .eq("post_id", post.id);

      const allPublished = targets?.every((t: any) => t.status === "published");
      const allFailed = targets?.every((t: any) => t.status === "failed");
      const finalStatus = allPublished ? "published" : allFailed ? "failed" : "partial";
      await updatePost(db, post.id, { status: finalStatus });
    });
  }
);
