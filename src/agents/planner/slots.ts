import { platformMeta } from "@/config/platforms";
import { AD_OBJECTIVES, type AdObjective, type Format } from "@/core/creative/brief";
import { MIX_VIDEO_SHARE, stylesFor, type StyleFormat } from "@/core/content/styles";
import type { ContentMix, ImageStyle, PeopleChoice, VideoStyle } from "@/core/onboarding/options";
import type { FunnelStage } from "@/core/plans/types";
import { addDays, zonedToUtc } from "@/lib/zoned-time";

// The Planner's rule-based half (code, no AI): how many slots, on which days, platforms and
// times, in which format and content style, for which pillar and goal, and which are experiments.
// The client's content mix sets the share of videos; their styles (in priority order) set which
// styles rotate through the week.

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
  /** The client's image or video style for this slot; null for text posts */
  style: ImageStyle | VideoStyle | null;
  /** The goal this slot serves (the client's first goal gets about two thirds of the slots) */
  goal: string | null;
  pillarId: string | null;
  pillarName: string | null;
  /** What the post is for: reach new people, turn interest into action, or bring back people who know the brand */
  adObjective: AdObjective;
  funnelStage: FunnelStage;
  isExperiment: boolean;
}

export type BatchCounts = Record<"static" | "carousel" | "video", number>;

/** Round-robin over the kinds, so one kind doesn't bunch up: {static 2, video 1} → static, video, static */
export function batchFormats(counts: BatchCounts): Format[] {
  const left = { ...counts };
  const out: Format[] = [];
  while (out.length < MAX_SLOTS && (left.static > 0 || left.carousel > 0 || left.video > 0)) {
    for (const f of ["static", "carousel", "video"] as const) {
      if (left[f] > 0 && out.length < MAX_SLOTS) {
        out.push(f);
        left[f]--;
      }
    }
  }
  return out;
}

export interface SlotInput {
  weekStart: string;
  timezone: string;
  /** Posts per week per platform */
  postsPerWeek: Record<string, number>;
  pillars: PillarShare[];
  /** The client's goals, ranked */
  goals?: string[];
  /** The client's content mix; null = Prodo's own balance */
  mix?: ContentMix | null;
  /** The client's styles in priority order (empty = any) */
  styles?: { image: ImageStyle[]; video: VideoStyle[] };
  people?: PeopleChoice | null;
  /** The client has a video of someone talking to camera (talking and customer-video styles stay real) */
  talkingFootage?: boolean;
  /** Style → score vs. baseline from learnings (1 = average) */
  styleScores?: Record<string, number>;
  /** Format → score vs. baseline from learnings (1 = average); missing = no data */
  formatScores?: Partial<Record<Format, number>>;
  /** Platform → best "HH:MM" from learnings, when known */
  bestTimes?: Record<string, string>;
  /** First day that may get a post (planning the current week: tomorrow). Default: weekStart */
  firstDay?: string;
  /** False while the video renderer isn't set up: no video slots, video-only platforms are left out */
  videoAllowed?: boolean;
  /**
   * "Auto-create": a chosen number of posts of each kind over the given days instead of a week's worth.
   * The kinds are interleaved; every post goes to the platforms that take its format, the busiest
   * platform getting all of them and the others their share.
   */
  batch?: { counts: BatchCounts; days: string[] };
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

/** Share of slots for the first goal when the client ranked two. */
const FIRST_GOAL_SHARE = 2 / 3;

export const EXPERIMENT_SHARE = 0.3;
export const MAX_SLOTS = 21;

/**
 * Starting share of awareness, converting and retargeting posts by the client's first goal (knowledge
 * base §7.2), so the account is never all hard sells.
 */
export const OBJECTIVE_MIX: Record<string, Record<AdObjective, number>> = {
  awareness: { awareness: 0.6, converting: 0.3, retargeting: 0.1 },
  followers: { awareness: 0.6, converting: 0.3, retargeting: 0.1 },
  leads: { awareness: 0.4, converting: 0.45, retargeting: 0.15 },
  bookings: { awareness: 0.4, converting: 0.45, retargeting: 0.15 },
  sales: { awareness: 0.35, converting: 0.45, retargeting: 0.2 },
};
const DEFAULT_MIX = OBJECTIVE_MIX.leads;

const OBJECTIVE_STAGE: Record<AdObjective, FunnelStage> = { awareness: "tofu", converting: "mofu", retargeting: "bofu" };
const STAGE_OBJECTIVE: Record<FunnelStage, AdObjective> = { tofu: "awareness", mofu: "converting", bofu: "retargeting" };

/**
 * Each slot's objective: the goal's mix split over the slots, a pillar made for one funnel stage
 * getting that objective while it has some left, the rest spread so one objective doesn't bunch up.
 */
export function objectiveSequence(pillars: (PillarShare | null)[], goal: string | null): AdObjective[] {
  const mix = OBJECTIVE_MIX[goal ?? ""] ?? DEFAULT_MIX;
  const left = allocate(pillars.length, AD_OBJECTIVES.map((id) => ({ id, share: mix[id] })));
  const total = new Map(left);
  return pillars.map((pillar, i) => {
    const wanted = pillar?.funnelStage ? STAGE_OBJECTIVE[pillar.funnelStage] : null;
    // Otherwise the objective furthest behind its share at this point of the week
    const behind = (o: AdObjective) => (total.get(o)! * (i + 1)) / pillars.length - (total.get(o)! - left.get(o)!);
    const pick = wanted && left.get(wanted)! > 0 ? wanted : [...AD_OBJECTIVES].filter((o) => left.get(o)! > 0).sort((a, b) => behind(b) - behind(a))[0] ?? "awareness";
    left.set(pick, Math.max(0, left.get(pick)! - 1));
    return pick;
  });
}

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

/** Starting weights: the client's content mix sets the video share, the rest keeps its balance. */
export function mixWeights(mix?: ContentMix | null): Record<Format, number> {
  if (!mix) return { ...BASE_WEIGHTS };
  const video = MIX_VIDEO_SHARE[mix];
  const rest = 1 - BASE_WEIGHTS.video;
  return {
    static: (BASE_WEIGHTS.static / rest) * (1 - video),
    carousel: (BASE_WEIGHTS.carousel / rest) * (1 - video),
    text: (BASE_WEIGHTS.text / rest) * (1 - video),
    video,
  };
}

function formatWeights(scores?: SlotInput["formatScores"], mix?: ContentMix | null): Record<Format, number> {
  const w = mixWeights(mix);
  for (const [format, score] of Object.entries(scores ?? {}) as [Format, number][]) {
    // Proven formats get more slots, weak ones fewer, never zero (keep testing); a format the
    // client's mix leaves out stays out
    if (w[format] > 0) w[format] = Math.max(0.05, w[format] * Math.min(1.8, Math.max(0.5, score)));
  }
  return w;
}

/** Styles each format may use; a format with none (e.g. carousels when every picked style is a single image) isn't planned. */
function styleOptions(input: SlotInput): Record<StyleFormat, (ImageStyle | VideoStyle)[]> {
  const picked = input.styles ?? { image: [], video: [] };
  const people = input.people ?? null;
  const video = stylesFor("video", picked, people, input.talkingFootage);
  return {
    static: stylesFor("static", picked, people, input.talkingFootage),
    carousel: stylesFor("carousel", picked, people, input.talkingFootage),
    // Every video can at least be a voice-over explainer
    video: video.length ? video : ["faceless"],
  };
}

/**
 * Picks styles in rotation: higher in the client's list = more often, proven in learnings = more
 * often, never the same style twice in a row when there's a choice.
 */
function styleRotation(options: Record<StyleFormat, (ImageStyle | VideoStyle)[]>, scores: Record<string, number> = {}) {
  const used = new Map<string, number>();
  let last: string | null = null;
  return (format: Format): ImageStyle | VideoStyle | null => {
    if (format === "text") return null;
    const list = options[format];
    const weight = (s: ImageStyle | VideoStyle) => (list.length - list.indexOf(s)) * Math.min(1.8, Math.max(0.5, scores[s] ?? 1));
    const ranked = [...list].sort((a, b) => (used.get(a) ?? 0) / weight(a) - (used.get(b) ?? 0) / weight(b));
    const pick = ranked.find((s) => s !== last) ?? ranked[0];
    used.set(pick, (used.get(pick) ?? 0) + 1);
    last = pick;
    return pick;
  };
}

export function planSlots(input: SlotInput): SlotPlan[] {
  const batch = input.batch;
  // Images only: no video slots and no video-only platforms (unless a batch asks for videos by name)
  const batchFormatList = batch ? batchFormats(batch.counts) : null;
  const videoAllowed = input.videoAllowed !== false && (input.mix !== "images" || !!batchFormatList?.includes("video"));
  const days = batch?.days ?? openDays(input.weekStart, input.firstDay);
  if (!days.length) return [];
  // A part week gets its share of the posts; platforms that only take video wait for the video renderer
  const weekly = Object.entries(input.postsPerWeek)
    .filter(([platform, n]) => n > 0 && (videoAllowed || platformMeta(platform).supportsImages))
    .filter(([platform]) => !batchFormatList || batchFormatList.some((f) => allowedFormats([platform], videoAllowed).includes(f)));
  // A batch only keeps the posts some platform can take
  const formatsOfBatch = batchFormatList?.filter((f) => weekly.some(([platform]) => allowedFormats([platform], videoAllowed).includes(f))) ?? null;
  const busiest = Math.max(1, ...weekly.map(([, n]) => n));
  const batchTotal = formatsOfBatch?.length ?? 0;
  const counts = weekly.map(([platform, n]) =>
    batch ? ([platform, Math.max(1, Math.round((n * batchTotal) / busiest))] as [string, number]) : ([platform, days.length < 7 ? Math.ceil((n * days.length) / 7) : n] as [string, number])
  );
  const total = Math.min(MAX_SLOTS, batch ? (counts.length ? batchTotal : 0) : Math.max(0, ...counts.map(([, n]) => n)));
  if (!total) return [];

  // Which platforms each slot goes to: every platform spreads its posts across the slots it can take
  const platformsBySlot: string[][] = Array.from({ length: total }, () => []);
  for (const [platform, n] of counts) {
    const can = formatsOfBatch ? [...Array(total).keys()].filter((i) => allowedFormats([platform], videoAllowed).includes(formatsOfBatch[i])) : [...Array(total).keys()];
    spread(Math.min(n, can.length), can.length).forEach((k) => platformsBySlot[can[k]].push(platform));
  }

  const pillars = pillarSequence(total, input.pillars);
  const weights = formatWeights(input.formatScores, input.mix);
  const styles = styleOptions(input);
  // Asked for a kind by name, but none of the client's picked styles fit it: any style that does
  for (const f of new Set(formatsOfBatch ?? [])) {
    if (f !== "text" && !styles[f].length) styles[f] = stylesFor(f, { image: [], video: [] }, input.people ?? null, input.talkingFootage);
  }
  const nextStyle = styleRotation(styles, input.styleScores);
  const goals = (input.goals ?? []).filter(Boolean);
  const secondGoal = new Set(goals.length > 1 ? spread(Math.round(total * (1 - FIRST_GOAL_SHARE)), total) : []);
  const used: Record<Format, number> = { static: 0, carousel: 0, video: 0, text: 0 };
  // Each goal's slots follow that goal's objective mix
  const objectives: AdObjective[] = [];
  for (const g of new Set(platformsBySlot.map((_, i) => goals[secondGoal.has(i) ? 1 : 0] ?? null))) {
    const mine = platformsBySlot.map((_, i) => i).filter((i) => (goals[secondGoal.has(i) ? 1 : 0] ?? null) === g);
    objectiveSequence(mine.map((i) => pillars[i]), g).forEach((o, k) => (objectives[mine[k]] = o));
  }
  const experiments = new Set(spread(Math.round(total * EXPERIMENT_SHARE), total).map((i) => (i + 1) % total));
  const perDay = new Map<string, number>();
  const lastFormat = new Map<string, Format>();

  return platformsBySlot.map((platforms, index) => {
    const day = days[Math.floor((index * days.length) / total)];
    const lead = [...platforms].sort((a, b) => (input.postsPerWeek[b] ?? 0) - (input.postsPerWeek[a] ?? 0))[0];
    const base = input.bestTimes?.[lead] ?? DEFAULT_TIMES[lead] ?? "12:00";
    // A second slot on the same day goes three hours later (an hour and a half when all the posts share one day)
    const nth = perDay.get(day) ?? 0;
    perDay.set(day, nth + 1);
    const [h, m] = base.split(":").map(Number);
    const minutes = Math.min(22 * 60 + 30, h * 60 + m + nth * (days.length === 1 ? 90 : 180));
    const time = `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

    // Format: the most under-used one (by weight) the platforms take, never the same as the last
    // post on any of these platforms when there's a choice
    const allowed = allowedFormats(platforms, videoAllowed).filter((f) => (formatsOfBatch ? f === formatsOfBatch[index] && f !== "text" && styles[f].length > 0 : f === "text" || (weights[f] > 0 && styles[f].length)));
    const ranked = [...allowed].sort((a, b) => used[a] / weights[a] - used[b] / weights[b]);
    // A format meant for more than half the posts (e.g. "mostly videos") may repeat
    const weightSum = allowed.reduce((sum, f) => sum + weights[f], 0) || 1;
    const dominant = ranked[0] && weights[ranked[0]] / weightSum > 0.5;
    const format = (dominant ? ranked[0] : ranked.find((f) => platforms.every((p) => lastFormat.get(p) !== f))) ?? ranked[0] ?? "static";
    used[format]++;
    platforms.forEach((p) => lastFormat.set(p, format));

    const pillar = pillars[index];
    const goal = goals[secondGoal.has(index) ? 1 : 0] ?? null;
    return {
      index,
      day,
      time,
      slotAt: zonedToUtc(day, time, input.timezone).toISOString(),
      platforms,
      format,
      style: nextStyle(format),
      goal,
      pillarId: pillar?.id ?? null,
      pillarName: pillar?.name ?? null,
      adObjective: objectives[index],
      funnelStage: OBJECTIVE_STAGE[objectives[index]],
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
