import { inngest } from "./client";
import { businessDb } from "@/lib/supabase/business";
import { notify } from "@/core/notifications/notify";
import { publisherFor } from "@/providers/publishing/registry";

// The pause switch also holds posts already handed to the publishing provider: pausing takes them
// back (they wait as drafts with their time kept); turning Prodo back on schedules the ones whose
// time hasn't passed and tells the client about the rest.

export const HELD = "Held while Prodo was paused";
const MIN_LEAD_MS = 2 * 60_000;

export const applyPause = inngest.createFunction(
  { id: "apply-pause", concurrency: [{ limit: 1, key: "event.data.businessId" }], retries: 2 },
  { event: "settings/paused-changed" },
  async ({ event, step }) => {
    const { businessId } = event.data;
    if (event.data.paused) {
      const postIds = await step.run("scheduled-posts", async () => {
        const { data, error } = await businessDb(businessId).from("posts").select("id").eq("status", "scheduled").gt("publish_at", new Date().toISOString());
        if (error) throw error;
        return (data ?? []).map((p) => p.id);
      });
      for (const postId of postIds) {
        await step.run(`hold-${postId}`, async () => {
          const db = businessDb(businessId);
          const { data: targets } = await db.from("post_targets").select("id, provider, provider_ref").eq("post_id", postId);
          for (const t of targets ?? []) {
            if (t.provider_ref) await publisherFor(t.provider).cancelScheduled(t.provider_ref);
          }
          await db.from("post_targets").update({ status: "pending", provider_ref: null, url: null, error: HELD }).eq("post_id", postId);
          await db.from("posts").update({ status: "draft" }).eq("id", postId);
        });
        await step.sendEvent(`stop-check-${postId}`, { name: "post/cancelled", data: { businessId, postId } });
      }
      return { held: postIds.length };
    }

    // Back on: schedule the held posts again
    const held = await step.run("held-posts", async () => {
      const { data, error } = await businessDb(businessId).from("post_targets").select("post_id, posts!inner(id, status, publish_at)").eq("error", HELD).eq("posts.status", "draft");
      if (error) throw error;
      const byPost = new Map<string, string | null>();
      for (const row of data ?? []) {
        const post = Array.isArray(row.posts) ? row.posts[0] : row.posts;
        if (post) byPost.set(post.id, post.publish_at);
      }
      return [...byPost.entries()].map(([id, publishAt]) => ({ id, publishAt }));
    });

    let resumed = 0;
    const missed: string[] = [];
    for (const post of held) {
      const onTime = !!post.publishAt && new Date(post.publishAt).getTime() > Date.now() + MIN_LEAD_MS;
      await step.run(`resume-${post.id}`, async () => {
        const db = businessDb(businessId);
        if (onTime) {
          await db.from("post_targets").update({ error: null }).eq("post_id", post.id);
          await db.from("posts").update({ status: "scheduled" }).eq("id", post.id);
        } else {
          await db.from("post_targets").update({ error: "Its time passed while Prodo was paused. Pick a new time." }).eq("post_id", post.id);
        }
      });
      if (onTime) {
        resumed++;
        await step.sendEvent(`publish-${post.id}`, { name: "post/publish", id: `resume-${post.id}-${Date.now()}`, data: { businessId, postId: post.id } });
      } else missed.push(post.id);
    }
    if (missed.length) {
      await step.run("tell-client", () =>
        notify(businessDb(businessId), {
          kind: "post_failed",
          title: `${missed.length} ${missed.length === 1 ? "post" : "posts"} missed their time while Prodo was paused`,
          body: "They're waiting as drafts in Posts. Pick a new time for each.",
          link: "/posts",
          email: true,
        })
      );
    }
    return { resumed, missed: missed.length };
  }
);
