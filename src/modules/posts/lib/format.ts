import type { PostStatus, PostWithTargets, TargetStatus } from "@/core/posts";

/** A post as the API returns it: `select *` also brings the agent columns. */
export type PostRow = PostWithTargets & { origin?: "manual" | "agent"; plan_item_id?: string | null };

type Tone = "neutral" | "primary" | "success" | "warn" | "danger";

export const POST_STATUS: Record<PostStatus, { label: string; tone: Tone }> = {
  draft: { label: "Draft", tone: "neutral" },
  scheduled: { label: "Scheduled", tone: "primary" },
  publishing: { label: "Publishing", tone: "warn" },
  published: { label: "Published", tone: "success" },
  partial: { label: "Partly published", tone: "warn" },
  failed: { label: "Failed", tone: "danger" },
};

export const TARGET_STATUS: Record<TargetStatus, { label: string; dot: string }> = {
  pending: { label: "Waiting", dot: "bg-ob-faint" },
  sending: { label: "Sending", dot: "bg-ob-warn animate-pulse" },
  published: { label: "Live", dot: "bg-ob-success" },
  failed: { label: "Failed", dot: "bg-ob-danger" },
};

/** Status tabs on the Posts page; each covers one or more post statuses. */
export const POST_TABS = [
  { value: "all", label: "All", statuses: null },
  { value: "scheduled", label: "Scheduled", statuses: ["scheduled", "publishing"] },
  { value: "published", label: "Published", statuses: ["published", "partial"] },
  { value: "draft", label: "Drafts", statuses: ["draft"] },
  { value: "failed", label: "Failed", statuses: ["failed"] },
] as const satisfies readonly { value: string; label: string; statuses: readonly PostStatus[] | null }[];

export type PostTab = (typeof POST_TABS)[number]["value"];

export function inTab(post: PostRow, tab: PostTab): boolean {
  const statuses = POST_TABS.find((t) => t.value === tab)?.statuses;
  return !statuses || (statuses as readonly PostStatus[]).includes(post.status);
}

export function isUpcoming(post: PostRow): boolean {
  return (post.status === "scheduled" || post.status === "publishing") && !!post.publish_at;
}

/** When the post happened or will happen: schedule, else the latest live time, else when it was made. */
export function postDate(post: PostRow): Date {
  if (post.publish_at) return new Date(post.publish_at);
  const live = post.post_targets.map((t) => t.published_at).filter(Boolean) as string[];
  if (live.length) return new Date(live.sort().at(-1)!);
  return new Date(post.created_at);
}

export function postTitle(post: PostRow): string {
  const caption = post.post_targets.find((t) => t.caption?.trim())?.caption;
  return (caption || post.media?.idea || post.media?.content || "Untitled post").trim();
}

export function platformsOf(post: PostRow): string[] {
  return [...new Set(post.post_targets.map((t) => t.platform))];
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const DAY_MS = 86_400_000;

export function dayLabel(date: Date, now = new Date()): string {
  const diff = Math.round((startOfDay(date).getTime() - startOfDay(now).getTime()) / DAY_MS);
  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", ...(sameYear ? {} : { year: "numeric" }) });
}

export function timeOfDay(date: Date): string {
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

/** "in 3 h", "5 min ago", "in 2 days" */
export function relative(date: Date, now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const unit =
    abs < 60_000 ? "now" : abs < 3_600_000 ? `${Math.round(abs / 60_000)} min` : abs < DAY_MS ? `${Math.round(abs / 3_600_000)} h` : `${Math.round(abs / DAY_MS)} days`;
  if (unit === "now") return "just now";
  return diff > 0 ? `in ${unit}` : `${unit} ago`;
}

/** One line under the title: "In 3 h · Tue 9:00 AM", "Published 2 h ago", "Draft · made 2 days ago". */
export function whenLine(post: PostRow): string {
  const date = postDate(post);
  if (isUpcoming(post)) return `${capitalise(relative(date))} · ${dayLabel(date)} ${timeOfDay(date)}`;
  if (post.status === "draft") return `Draft · made ${relative(new Date(post.created_at))}`;
  if (post.status === "failed") return `Failed · ${dayLabel(date)} ${timeOfDay(date)}`;
  return `Published ${relative(date)}`;
}

const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export interface DayGroup {
  key: string;
  label: string;
  posts: PostRow[];
}

/** Posts in day groups, upcoming first (soonest on top), then the rest (newest on top). */
export function groupByDay(posts: PostRow[]): { upcoming: DayGroup[]; earlier: DayGroup[] } {
  const upcoming = posts.filter(isUpcoming).sort((a, b) => postDate(a).getTime() - postDate(b).getTime());
  const earlier = posts.filter((p) => !isUpcoming(p)).sort((a, b) => postDate(b).getTime() - postDate(a).getTime());
  return { upcoming: toGroups(upcoming), earlier: toGroups(earlier) };
}

function toGroups(posts: PostRow[]): DayGroup[] {
  const groups: DayGroup[] = [];
  for (const post of posts) {
    const date = postDate(post);
    const key = startOfDay(date).toISOString();
    const last = groups.at(-1);
    if (last?.key === key) last.posts.push(post);
    else groups.push({ key, label: dayLabel(date), posts: [post] });
  }
  return groups;
}
