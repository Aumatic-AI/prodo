import { zonedParts } from "@/lib/zoned-time";
import type { CalendarResponse, Entry, EventKind, ItemEntry, MediaKind, PostEntry } from "./types";

// Turns the API's posts and planned slots into one sorted list of entries, each on the client's day.

type Tone = "neutral" | "primary" | "success" | "warn" | "danger";

export const POST_STATUS: Record<PostEntry["status"], { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "primary" },
  publishing: { label: "Publishing", tone: "primary" },
  published: { label: "Published", tone: "success" },
  partial: { label: "Partly published", tone: "warn" },
  failed: { label: "Failed", tone: "danger" },
};

export const ITEM_STATUS: Record<ItemEntry["status"], { label: string; tone: Tone }> = {
  planned: { label: "Planned", tone: "neutral" },
  briefed: { label: "Being made", tone: "neutral" },
  producing: { label: "Being made", tone: "neutral" },
  qa: { label: "Quality check", tone: "neutral" },
  ready: { label: "Ready to approve", tone: "primary" },
  needs_review: { label: "Needs your look", tone: "warn" },
  approved: { label: "Approved", tone: "success" },
  rejected: { label: "Skipped", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "primary" },
  published: { label: "Published", tone: "success" },
  failed: { label: "Failed", tone: "danger" },
};

export const statusOf = (e: Entry) => (e.kind === "post" ? POST_STATUS[e.status] : ITEM_STATUS[e.status]);

/** Dot colour per tone */
export const TONE_DOT: Record<Tone, string> = {
  neutral: "bg-ob-faint",
  primary: "bg-ob-primary",
  success: "bg-ob-success",
  warn: "bg-ob-warn",
  danger: "bg-ob-danger",
};

export const EVENT_STYLE: Record<EventKind, { label: string; bar: string; chip: string }> = {
  sale: { label: "Sale", bar: "bg-ob-warn", chip: "bg-ob-warn-soft text-ob-warn" },
  launch: { label: "Launch", bar: "bg-ob-primary", chip: "bg-ob-primary-soft text-ob-primary" },
  holiday: { label: "Holiday", bar: "bg-ob-success", chip: "bg-ob-success-soft text-ob-success" },
  trend: { label: "Trend", bar: "bg-ob-ink-soft", chip: "bg-ob-sunken text-ob-ink-soft" },
};

const FORMAT_MEDIA: Record<ItemEntry["format"], MediaKind> = { static: "image", carousel: "carousel", video: "video", text: "text" };

export function toEntries(data: CalendarResponse): Entry[] {
  const tz = data.clock.timezone;
  const place = (at: string) => {
    const p = zonedParts(new Date(at), tz);
    return { day: p.day, time: p.time };
  };

  const posts: PostEntry[] = data.posts.map((p) => {
    const at = p.publish_at ?? p.created_at;
    const caption = p.post_targets.find((t) => t.caption)?.caption;
    return {
      kind: "post",
      id: p.id,
      at,
      ...place(at),
      title: caption || p.media?.idea || p.media?.content || "Untitled post",
      status: p.status,
      byAgent: p.origin === "agent",
      platforms: p.post_targets.map((t) => ({ platform: t.platform, status: t.status })),
      thumbKey: p.media?.storage_key ?? null,
      mediaType: p.media?.type ?? null,
      href: `/posts/${p.id}`,
    };
  });

  const items: ItemEntry[] = data.items
    .filter((i) => i.status !== "rejected")
    .map((i) => ({
      kind: "item",
      id: i.id,
      at: i.slot_at,
      ...place(i.slot_at),
      title: i.angle || i.hook_text || "Planned post",
      status: i.status,
      format: i.format,
      pillar: i.pillar?.name ?? null,
      platforms: i.platforms.map((platform) => ({ platform })),
      thumbKey: i.media?.status === "ready" ? i.media.storage_key : null,
      mediaType: (i.media?.type as MediaKind | undefined) ?? FORMAT_MEDIA[i.format],
      href: `/week?item=${i.id}`,
    }));

  return [...posts, ...items].sort((a, b) => a.at.localeCompare(b.at));
}

export function byDay<T extends { day: string }>(list: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>();
  for (const e of list) map.set(e.day, [...(map.get(e.day) ?? []), e]);
  return map;
}
