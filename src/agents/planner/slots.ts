import { platformMeta } from "@/config/platforms";
import type { Format } from "@/core/creative/brief";
import type { FunnelStage } from "@/core/plans/types";
import { addDays, zonedToUtc } from "@/lib/zoned-time";

// The Planner's rule-based half (code, no AI): how many slots, on which days, platforms and
// times, in which format, for which pillar, and which ones are experiments.

export interface PillarShare {
  id: string;
  name: string;
  share: number;
  funnelStage: FunnelStage | null;
}

export interface SlotPlan {
  index: number;
  day: string;
  time: string;
  slotAt: string;
  platforms: string[];
  format: Format;
  pillarId: string | null;
  pillarName: string | null;
  funnelStage: FunnelStage;
  isExperiment: boolean;
}

export interface SlotInput {
  weekStart: string;
  timezone: string;
  /** Posts per week per platform */
  postsPerWeek: Record<string, number>;
  pillars: PillarShare[];
  goal: string | null;
  /** Format → score vs. baseline from learnings (1 = average); missing = no data */
  formatScores?: Partial<Record<Format, number>>;
  /** Platform → best "HH:MM" from learnings, when known */
  bestTimes?: Record<string, string>;
  /** First day that may get a post (planning the current week: tomorrow). Default: weekStart */
  firstDay?: string;
  /** False while the video renderer isn't set up: no video slots, video-only platforms are left out */
  videoAllowed?: boolean;
}

/** Local posting times that work on average, used until there are 10+ own posts to learn from. */
export const DEFAULT_TIMES: Record<string, string> = {
  instagram: "18:00",
  facebook: "13:00",
  linkedin: "09:00",
  twitter: "12:00",
  tiktok: "19:00",
  youtube: "17:00",
};

/** Starting format mix when nothing is known yet. */
const BASE_WEIGHTS: Record<Format, number> = { static: 0.35, carousel: 0.25, video: 0.32, text: 0.08 };

export const EXPERIMENT_SHARE = 0.3;
export const MAX_SLOTS = 21;

const GOAL_STAGE: Record<string, FunnelStage> = { awareness: "tofu", followers: "tofu", leads: "mofu", sales: "bofu", bookings: "bofu" };

/** Positions 0…total-1 picked evenly, `count` of them. */
function spread(count: number, total: number): number[] {
  if (count <= 0) return [];
  if (count >= total) return Array.from({ length: total }, (_, i) => i);
  return Array.from({ length: count }, (_, k) => Math.floor((k * total) / count + total / (2 * count)));
}

/** Largest-remainder split of `total` slots by share. */
export function allocate(total: number, shares: { id: string; share: number }[]): Map<string, number> {
  const sum = shares.reduce((s, x) => s + x.share, 0) || 1;
  const raw = shares.map((x) => ({ id: x.id, exact: (x.share / sum) * total }));
  const out = new Map(raw.map((r) => [r.id, Math.floor(r.exact)]));
  let left = total - [...out.values()].reduce((a, b) => a + b, 0);
  for (const r of [...raw].sort((a, b) => (b.exact % 1) - (a.exact % 1))) {
    if (left <= 0) break;
    out.set(r.id, out.get(r.id)! + 1);
    left--;
  }
  return out;
}

/** Pillars in an order that never repeats one back to back when it can be avoided. */
function pillarSequence(total: number, pillars: PillarShare[]): (PillarShare | null)[] {
  if (!pillars.length) return Array(total).fill(null);
  const counts = allocate(total, pillars);
  const seq: PillarShare[] = [];
  for (let i = 0; i < total; i++) {
    const options = pillars.filter((p) => (counts.get(p.id) ?? 0) > 0).sort((a, b) => counts.get(b.id)! - counts.get(a.id)!);
    const pick = options.find((p) => p.id !== seq[seq.length - 1]?.id) ?? options[0];
    seq.push(pick);
    counts.set(pick.id, counts.get(pick.id)! - 1);
  }
  return seq;
}

/** Formats every platform in the slot can take. */
export function allowedFormats(platforms: string[], videoAllowed = true): Format[] {
  const videoOnly = platforms.some((p) => !platformMeta(p).supportsImages);
  if (videoOnly) return videoAllowed ? ["video"] : [];
  // Instagram and TikTok have no text-only posts
  const text = platforms.every((p) => ["facebook", "linkedin", "twitter"].includes(p));
  const formats: Format[] = text ? ["static", "carousel", "video", "text"] : ["static", "carousel", "video"];
  return videoAllowed ? formats : formats.filter((f) => f !== "video");
}

/** Days of the week that may still get a post, in order. */
export function openDays(weekStart: string, firstDay?: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)).filter((d) => !firstDay || d >= firstDay);
}

function formatWeights(scores?: SlotInput["formatScores"]): Record<Format, number> {
  const w = { ...BASE_WEIGHTS };
  for (const [format, score] of Object.entries(scores ?? {}) as [Format, number][]) {
    // Proven formats get more slots, weak ones fewer, never zero (keep testing)
    w[format] = Math.max(0.05, w[format] * Math.min(1.8, Math.max(0.5, score)));
  }
  return w;
}

export function planSlots(input: SlotInput): SlotPlan[] {
  const videoAllowed = input.videoAllowed !== false;
  const days = openDays(input.weekStart, input.firstDay);
  if (!days.length) return [];
  // A part week gets its share of the posts; platforms that only take video wait for the video renderer
  const counts = Object.entries(input.postsPerWeek)
    .filter(([platform, n]) => n > 0 && (videoAllowed || platformMeta(platform).supportsImages))
    .map(([platform, n]) => [platform, days.length < 7 ? Math.ceil((n * days.length) / 7) : n] as [string, number]);
  const total = Math.min(MAX_SLOTS, Math.max(0, ...counts.map(([, n]) => n)));
  if (!total) return [];

  // Which platforms each slot goes to: every platform spreads its posts across the slots
  const platformsBySlot: string[][] = Array.from({ length: total }, () => []);
  for (const [platform, n] of counts) spread(Math.min(n, total), total).forEach((i) => platformsBySlot[i].push(platform));

  const pillars = pillarSequence(total, input.pillars);
  const weights = formatWeights(input.formatScores);
  const used: Record<Format, number> = { static: 0, carousel: 0, video: 0, text: 0 };
  const experiments = new Set(spread(Math.round(total * EXPERIMENT_SHARE), total).map((i) => (i + 1) % total));
  const perDay = new Map<string, number>();
  const lastFormat = new Map<string, Format>();

  return platformsBySlot.map((platforms, index) => {
    const day = days[Math.floor((index * days.length) / total)];
    const lead = [...platforms].sort((a, b) => (input.postsPerWeek[b] ?? 0) - (input.postsPerWeek[a] ?? 0))[0];
    const base = input.bestTimes?.[lead] ?? DEFAULT_TIMES[lead] ?? "12:00";
    // A second slot on the same day goes three hours later
    const nth = perDay.get(day) ?? 0;
    perDay.set(day, nth + 1);
    const [h, m] = base.split(":").map(Number);
    const time = `${String(Math.min(22, h + nth * 3)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

    // Format: the most under-used one (by weight) the platforms take, never the same as the last
    // post on any of these platforms when there's a choice
    const allowed = allowedFormats(platforms, videoAllowed);
    const ranked = [...allowed].sort((a, b) => used[a] / weights[a] - used[b] / weights[b]);
    const format = ranked.find((f) => platforms.every((p) => lastFormat.get(p) !== f)) ?? ranked[0];
    used[format]++;
    platforms.forEach((p) => lastFormat.set(p, format));

    const pillar = pillars[index];
    return {
      index,
      day,
      time,
      slotAt: zonedToUtc(day, time, input.timezone).toISOString(),
      platforms,
      format,
      pillarId: pillar?.id ?? null,
      pillarName: pillar?.name ?? null,
      funnelStage: pillar?.funnelStage ?? GOAL_STAGE[input.goal ?? ""] ?? "tofu",
      isExperiment: experiments.has(index),
    };
  });
}

/** Swaps neighbours so the same format never runs twice in a row on a platform, when possible. */
export function avoidRepeats<T extends { platforms: string[] }>(slots: T[], key: (s: T) => string | null, swap: (a: T, b: T) => void): T[] {
  for (let i = 1; i < slots.length; i++) {
    const shares = slots[i].platforms.some((p) => slots[i - 1].platforms.includes(p));
    const k = key(slots[i]);
    if (!shares || !k || k !== key(slots[i - 1])) continue;
    const j = slots.findIndex((s, n) => n > i && key(s) !== k && key(s) !== key(slots[i - 1]) && (n + 1 >= slots.length || key(slots[n + 1]) !== k));
    if (j > 0) swap(slots[i], slots[j]);
  }
  return slots;
}
