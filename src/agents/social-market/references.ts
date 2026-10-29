import type { SupabaseClient } from "@supabase/supabase-js";
import { ai, type SocialPost } from "@/providers/ai/registry";
import { optional } from "@/agents/run";
import { inGroups, type AgentKit } from "@/agents/research/define";
import type { ResearchContext } from "@/agents/research/context";
import type { AnalyzedVideo } from "./hooks";

// Posts the client pasted in onboarding as the content they want. Read once (ScrapeCreators); their
// caption and numbers are kept on the link's brand_sources row, and what their video does well
// (Twelve Labs, in the video step) is added there too. Context for the Strategist, never a fact.

const MAX_LINKS = 10;
const PARALLEL = 3;

const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60);

export async function readReferences({ db, ctx, task }: { db: () => SupabaseClient; ctx: ResearchContext; task: AgentKit["task"] }) {
  const read = await inGroups(ctx.referenceLinks.slice(0, MAX_LINKS), PARALLEL, (link, i) =>
    optional(
      task(
        `reference-${i}`,
        async (track) => {
          const res = await ai.social.post(link.url);
          track(res.usage);
          const post = res.data;
          if (!post) return null;
          const { error } = await db()
            .from("brand_sources")
            .update({
              title: `Reference post on ${post.platform}`,
              content_md: post.caption ?? "",
              metadata: { platform: post.platform, mediaType: post.mediaType, views: post.views, likes: post.likes, comments: post.comments },
              fetched_at: new Date().toISOString(),
            })
            .eq("id", link.id);
          if (error) throw error;
          return { id: link.id, post };
        },
        (r) => (r ? `Read your reference ${r.post.mediaType} on ${r.post.platform}` : `Couldn't open ${shortUrl(link.url)} (private, removed or not a post)`)
      )
    )
  );
  return read.filter((r): r is { id: string; post: SocialPost } => !!r);
}

/** What each reference video does well: kept on its link's row, or as a new row for an uploaded video. */
export async function saveReferenceLessons(db: SupabaseClient, videos: AnalyzedVideo[]): Promise<number> {
  // The client's own picks: linked posts (with their row) and uploaded videos, not brands they admire
  const lessons = videos.filter((v) => v.source === "reference" && (v.sourceId || v.platform === "upload"));
  // Uploaded videos are watched again on every refresh: their old rows are replaced
  if (lessons.some((v) => !v.sourceId)) {
    const { error } = await db.from("brand_sources").delete().eq("kind", "reference").is("url", null);
    if (error) throw error;
  }
  for (const v of lessons) {
    const a = v.analysis;
    const text = [a.hook && `Hook: ${a.hook}`, a.structure && `Structure: ${a.structure}`, `Pacing: ${a.pacing}`, a.whyItWorks && `Why it works: ${a.whyItWorks}`].filter(Boolean).join("\n");
    if (v.sourceId) {
      const { data } = await db.from("brand_sources").select("metadata").eq("id", v.sourceId).single();
      const { error } = await db.from("brand_sources").update({ metadata: { ...(data?.metadata ?? {}), analysis: a, lesson: text } }).eq("id", v.sourceId);
      if (error) throw error;
    } else {
      // An uploaded video has no link, so it gets its own row (no URL: the file stays in our storage)
      const { error } = await db.from("brand_sources").insert({ kind: "reference", title: "Video you uploaded", content_md: text, metadata: { analysis: a, lesson: text } });
      if (error) throw error;
    }
  }
  return lessons.length;
}
