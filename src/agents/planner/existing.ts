import type { SupabaseClient } from "@supabase/supabase-js";
import type { Format } from "@/core/creative/brief";
import { addDays, zonedParts, zonedToUtc } from "@/lib/zoned-time";

// Posts already set for the days being planned: ones the client scheduled by hand, and slots planned
// before (Auto-create). Planning takes them off the week's counts and fills the days around them.

export interface ExistingPost {
  day: string;
  platforms: string[];
  format: Format;
}

/** Posts that still go out (or went out): drafts and failed ones don't take a place. */
const LIVE_POSTS = ["scheduled", "publishing", "published", "partial"];
const DEAD_ITEMS = ["rejected", "failed"];

const MEDIA_FORMAT: Record<string, Format> = { image: "static", carousel: "carousel", video: "video", text: "text" };

export async function loadExisting(db: SupabaseClient, days: string[], timezone: string): Promise<ExistingPost[]> {
  if (!days.length) return [];
  const from = zonedToUtc(days[0], "00:00", timezone).toISOString();
  const to = zonedToUtc(addDays(days[days.length - 1], 1), "00:00", timezone).toISOString();

  // A post made from a plan slot is counted through its slot, so only posts without one are read here
  const [posts, items] = await Promise.all([
    db
      .from("posts")
      .select("publish_at, media(type), post_targets(platform)")
      .is("plan_item_id", null)
      .in("status", LIVE_POSTS)
      .gte("publish_at", from)
      .lt("publish_at", to),
    db
      .from("plan_items")
      .select("slot_at, platforms, format")
      .not("status", "in", `(${DEAD_ITEMS.join(",")})`)
      .gte("slot_at", from)
      .lt("slot_at", to),
  ]);
  if (posts.error) throw posts.error;
  if (items.error) throw items.error;

  const dayOf = (at: string) => zonedParts(new Date(at), timezone).day;
  const open = new Set(days);
  const out: ExistingPost[] = [
    ...(posts.data ?? []).map((p) => {
      const media = p.media as unknown as { type: string } | null;
      return {
        day: dayOf(p.publish_at as string),
        platforms: [...new Set(((p.post_targets ?? []) as { platform: string }[]).map((t) => t.platform))],
        format: MEDIA_FORMAT[media?.type ?? ""] ?? "static",
      };
    }),
    ...(items.data ?? []).map((i) => ({ day: dayOf(i.slot_at as string), platforms: (i.platforms ?? []) as string[], format: i.format as Format })),
  ];
  return out.filter((p) => open.has(p.day)).sort((a, b) => a.day.localeCompare(b.day));
}
