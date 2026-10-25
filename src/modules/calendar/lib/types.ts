import type { PostStatus, PostWithTargets } from "@/core/posts";
import type { ItemStatus, PlanItemView } from "@/core/plans/types";
import type { Format } from "@/core/creative/brief";

// What GET /api/calendar returns, and the flat entries the calendar draws.

export const EVENT_KINDS = ["sale", "launch", "holiday", "trend"] as const;
export type EventKind = (typeof EVENT_KINDS)[number];

export interface CalendarEvent {
  id: string;
  date: string;
  name: string;
  kind: EventKind;
  relevance: number;
  source: "system" | "client" | "serp";
  notes: string | null;
}

export interface CalendarResponse {
  clock: { timezone: string; today: string; thisWeek: string; nextWeek: string };
  from: string;
  to: string;
  posts: (PostWithTargets & { origin?: "manual" | "agent"; plan_item_id?: string | null })[];
  items: PlanItemView[];
  events: CalendarEvent[];
}

export type MediaKind = "image" | "video" | "text" | "carousel";

interface EntryBase {
  id: string;
  /** ISO instant */
  at: string;
  /** Day and time in the client's time zone */
  day: string;
  time: string;
  title: string;
  platforms: { platform: string; status?: string }[];
  thumbKey: string | null;
  mediaType: MediaKind | null;
  href: string;
}

export interface PostEntry extends EntryBase {
  kind: "post";
  status: PostStatus;
  byAgent: boolean;
}

export interface ItemEntry extends EntryBase {
  kind: "item";
  status: ItemStatus;
  format: Format;
  pillar: string | null;
}

export type Entry = PostEntry | ItemEntry;
