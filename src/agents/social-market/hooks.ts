import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/config/models";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";
import { HOOKS_SYSTEM, hooksPrompt, hooksSchema } from "@/prompts/agents/hooks";
import { videoAnalysisPrompt, videoAnalysisSchema, VIDEO_ANALYSIS_JSON_SCHEMA, type VideoAnalysis } from "@/prompts/agents/video-analysis";
import { nameKey } from "@/agents/research/text";

// Hook library seeds: opening lines from our best posts (own_winner, with their score) and from
// competitors' best posts and videos (competitor, no score).

export const MAX_OWN_VIDEOS = 6;
export const MAX_COMPETITOR_VIDEOS = 4;

export interface HookPost {
  platform: string;
  caption: string;
  source: "own_winner" | "competitor";
  score: number | null;
}

export interface VideoToAnalyze {
  url: string;
  platform: string;
  source: "own_top" | "own_bottom" | "competitor";
  label: string;
  score: number | null;
}

export interface AnalyzedVideo extends VideoToAnalyze {
  analysis: VideoAnalysis;
}

export async function analyzeVideo(video: VideoToAnalyze): Promise<{ analysis: VideoAnalysis; usage: Usage }> {
  const context =
    video.source === "competitor"
      ? `It's from a competitor (${video.label}).`
      : `It's from the brand's own ${video.platform} account and performed ${video.source === "own_top" ? "well above" : "well below"} its average.`;
  const res = await ai.analyzeVideo(video.url, videoAnalysisPrompt(context), VIDEO_ANALYSIS_JSON_SCHEMA);
  return {
    analysis: videoAnalysisSchema.parse(res.data ?? {}),
    usage: res.usage,
  };
}

/** AI picks the usable hooks from post captions; video hooks are added as they are. Saves new ones and embeds them. */
export async function saveHooks(db: SupabaseClient, posts: HookPost[], videos: AnalyzedVideo[]): Promise<{ saved: number; usage: Usage[] }> {
  const usage: Usage[] = [];
  const candidates: {
    text: string;
    hook_type: string | null;
    platform: string | null;
    source: HookPost["source"];
    score: number | null;
  }[] = [];

  if (posts.length) {
    const res = await ai.structured(
      hooksSchema,
      hooksPrompt(
        posts.map((p) => ({
          platform: p.platform,
          caption: p.caption,
          note: p.source === "competitor" ? "competitor" : undefined,
        }))
      ),
      {
        system: HOOKS_SYSTEM,
        model: MODELS.analyze,
      }
    );
    usage.push(res.usage);
    for (const hook of res.data.hooks) {
      const post = posts[hook.from - 1];
      if (!post) continue;
      candidates.push({
        text: hook.text,
        hook_type: hook.hookType,
        platform: hook.platform ?? post.platform,
        source: post.source,
        score: post.score,
      });
    }
  }

  // Weak own videos teach what to avoid, not what to reuse
  for (const v of videos.filter((v) => v.source !== "own_bottom" && v.analysis.hook)) {
    candidates.push({
      text: v.analysis.hook.slice(0, 300),
      hook_type: v.analysis.hookType || null,
      platform: v.platform,
      source: v.source === "competitor" ? "competitor" : "own_winner",
      score: v.source === "competitor" ? null : v.score,
    });
  }

  const { data: existing, error } = await db.from("hook_library").select("text");
  if (error) throw error;
  const seen = new Set((existing ?? []).map((h) => nameKey(h.text)));
  const fresh = candidates.filter((c) => {
    const key = nameKey(c.text);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (!fresh.length) return { saved: 0, usage };

  const vectors = await ai.embed(fresh.map((h) => h.text));
  usage.push(vectors.usage);
  const { error: insertError } = await db.from("hook_library").insert(
    fresh.map((h, i) => ({
      ...h,
      embedding: JSON.stringify(vectors.data[i]),
    }))
  );
  if (insertError) throw insertError;
  return { saved: fresh.length, usage };
}
