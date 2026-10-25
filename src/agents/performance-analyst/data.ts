import type { SupabaseClient } from "@supabase/supabase-js";
import { engagementRate, engagements, hourSlot, type Dimension, type MetricsLike } from "./score";

// What the Performance Analyst learns from: every post published in the window with its latest
// numbers and the plan's tags (angle, hook, format…), plus the slots the client rejected.

export interface PerfPost {
  targetId: string;
  postId: string;
  platform: string;
  publishedAt: string;
  caption: string;
  url: string | null;
  media: { id: string; type: string; storage_key: string | null } | null;
  planItemId: string | null;
  hookText: string | null;
  tags: { dimension: Dimension; value: string }[];
  metrics: MetricsLike & { clicks: number | null };
  er: number | null;
  views: number | null;
  reach: number | null;
  engagements: number;
}

const one = <T,>(v: T | T[] | null | undefined): T | null => (Array.isArray(v) ? (v[0] ?? null) : (v ?? null));
const FORMAT_OF_MEDIA: Record<string, string> = { image: "static", video: "video", carousel: "carousel", text: "text" };

type ItemTags = {
  id: string;
  angle: string | null;
  hook_type: string | null;
  hook_text: string | null;
  format: string;
  framework: string | null;
  levers: string[] | null;
  pillar_id: string | null;
  persona_id: string | null;
};

export function tagsOf(item: ItemTags | null, mediaType: string | null, publishedAt: string, tz: string): PerfPost["tags"] {
  const tags: PerfPost["tags"] = [{ dimension: "time_slot", value: hourSlot(publishedAt, tz) }];
  const format = item?.format ?? (mediaType ? FORMAT_OF_MEDIA[mediaType] : null);
  if (format) tags.push({ dimension: "format", value: format });
  if (!item) return tags;
  if (item.angle) tags.push({ dimension: "angle", value: item.angle });
  if (item.hook_type) tags.push({ dimension: "hook_type", value: item.hook_type });
  if (item.framework) tags.push({ dimension: "framework", value: item.framework });
  for (const lever of item.levers ?? []) tags.push({ dimension: "lever", value: lever });
  if (item.pillar_id) tags.push({ dimension: "pillar", value: item.pillar_id });
  if (item.persona_id) tags.push({ dimension: "persona", value: item.persona_id });
  return tags;
}

export async function loadPerformance(db: SupabaseClient, sinceIso: string, tz: string): Promise<PerfPost[]> {
  const { data, error } = await db
    .from("post_targets")
    .select(
      "id, platform, caption, url, published_at, post:posts!inner(id, plan_item_id, media:media(id, type, storage_key), item:plan_items!posts_plan_item_id_fkey(id, angle, hook_type, hook_text, format, framework, levers, pillar_id, persona_id)), post_metrics(captured_on, impressions, reach, views, likes, comments, shares, saves, clicks, engagement_rate)"
    )
    .eq("status", "published")
    .gte("published_at", sinceIso);
  if (error) throw error;

  return (data ?? []).flatMap((t: any) => {
    const metrics = [...(t.post_metrics ?? [])].sort((a, b) => String(b.captured_on).localeCompare(String(a.captured_on)))[0];
    if (!metrics || !t.published_at) return [];
    const post = one(t.post);
    const media = one(post?.media) as PerfPost["media"];
    const item = one(post?.item) as ItemTags | null;
    const m: PerfPost["metrics"] = { ...metrics };
    return [
      {
        targetId: t.id,
        postId: post?.id,
        platform: t.platform,
        publishedAt: t.published_at,
        caption: t.caption ?? "",
        url: t.url,
        media,
        planItemId: post?.plan_item_id ?? null,
        hookText: item?.hook_text ?? null,
        tags: tagsOf(item, media?.type ?? null, t.published_at, tz),
        metrics: m,
        er: engagementRate(m),
        views: m.views ?? null,
        reach: m.reach ?? m.impressions ?? null,
        engagements: engagements(m),
      },
    ];
  });
}

/** Slots the client rejected in the window, with their tags (they count as weak posts at half weight). */
export async function loadRejected(db: SupabaseClient, sinceIso: string, tz: string) {
  const { data, error } = await db
    .from("feedback")
    .select("created_at, item:plan_items(id, angle, hook_type, hook_text, format, framework, levers, pillar_id, persona_id, platforms, slot_at)")
    .eq("action", "reject")
    .gte("created_at", sinceIso);
  if (error) throw error;
  return (data ?? []).flatMap((f: any) => {
    const item = one(f.item) as (ItemTags & { platforms: string[]; slot_at: string }) | null;
    if (!item) return [];
    // Time isn't the client's reason for skipping, so it doesn't count against the time slot
    const tags = tagsOf(item, null, item.slot_at, tz).filter((t) => t.dimension !== "time_slot");
    return item.platforms.map((platform) => ({ platform, tags }));
  });
}

/** Baselines the research saved (learnings, dimension baseline). */
export async function storedBaselines(db: SupabaseClient): Promise<Record<string, { er?: number; views?: number }>> {
  const { data } = await db.from("learnings").select("value, platform, score").eq("dimension", "baseline");
  const out: Record<string, { er?: number; views?: number }> = {};
  for (const row of data ?? []) {
    if (!row.platform) continue;
    out[row.platform] ??= {};
    if (row.value === "engagement_rate") out[row.platform].er = Number(row.score);
    if (row.value === "views") out[row.platform].views = Number(row.score);
  }
  return out;
}
