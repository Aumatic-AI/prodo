import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { ai } from "@/providers/ai/registry";
import { publicUrl } from "@/providers/storage/paths";
import type { Usage } from "@/providers/usage";
import { FOOTAGE_JSON_SCHEMA, footagePrompt, footageSchema, type FootageAnalysis } from "@/prompts/agents/footage";

// The client's own videos (onboarding "your own photos and videos", Brand → Assets), watched once:
// Twelve Labs logs the usable moments, saved on brand_assets.analysis. The Creative Director picks
// moments for scenes and the renderer cuts them in. Other brands' videos (reference_video) are
// studied by the Social & Market Analyst instead and never used as footage.

/** Videos watched per run (each one is a paid Twelve Labs call) */
export const MAX_VIDEOS_PER_RUN = 6;

const VIDEO = /\.(mp4|mov)$/i;
/** Kinds that are the client's own footage */
export const FOOTAGE_KINDS = ["general", "product_photo", "team", "location", "work", "person"];

export interface UnwatchedVideo {
  id: string;
  storage_key: string;
  kind: string;
  product: string | null;
}

/** The client's own videos without an analysis yet, oldest first. */
export async function unwatchedVideos(db: SupabaseClient, limit = MAX_VIDEOS_PER_RUN): Promise<UnwatchedVideo[]> {
  const { data, error } = await db
    .from("brand_assets")
    .select("id, storage_key, kind, offerings(name)")
    .in("kind", FOOTAGE_KINDS)
    .is("analysis", null)
    .order("created_at")
    .limit(200);
  if (error) throw error;
  return (data ?? [])
    .filter((a) => VIDEO.test(a.storage_key))
    .slice(0, limit)
    .map((a) => ({ id: a.id, storage_key: a.storage_key, kind: a.kind, product: (a.offerings as unknown as { name: string } | null)?.name ?? null }));
}

/** Moments inside the video, in order, with their times kept within its length. */
function tidy(a: FootageAnalysis): FootageAnalysis {
  const duration = a.duration || Math.max(0, ...a.moments.map((m) => m.end));
  const moments = a.moments
    .map((m) => ({ ...m, start: Math.max(0, m.start), end: Math.min(duration || m.end, m.end) }))
    .filter((m) => m.end - m.start >= 1)
    .sort((x, y) => x.start - y.start)
    .map((m) => ({ ...m, lines: m.lines.filter((l) => l.end > l.start && l.start >= m.start - 0.5 && l.end <= m.end + 0.5) }));
  return { ...a, duration, moments };
}

/**
 * Watches one video and saves what it shows. A video Twelve Labs can't read is saved with an
 * error, so it isn't paid for again on every run.
 */
export async function watchVideo(db: SupabaseClient, video: UnwatchedVideo, business: string): Promise<{ analysis: FootageAnalysis | null; usage: Usage | null }> {
  const context = [business, video.product && `This video is about: ${video.product}`].filter(Boolean).join("\n");
  try {
    const res = await ai.analyzeVideo(publicUrl(video.storage_key), footagePrompt(context), FOOTAGE_JSON_SCHEMA);
    const analysis = tidy(footageSchema.parse(res.data));
    const { error } = await db.from("brand_assets").update({ analysis, ai_description: analysis.summary || null }).eq("id", video.id);
    if (error) throw error;
    return { analysis, usage: res.usage };
  } catch (err) {
    // A passing outage is tried again by the step; only a video that can't be read is set aside
    if (err instanceof AppError && err.retryable) throw err;
    const message = err instanceof Error ? err.message.slice(0, 200) : "unreadable";
    await db.from("brand_assets").update({ analysis: { duration: 0, summary: "", orientation: "vertical", moments: [], error: message } }).eq("id", video.id);
    return { analysis: null, usage: null };
  }
}
