import type { SupabaseClient } from "@supabase/supabase-js";
import { approvedBible } from "@/core/plans/plans";
import { contentRules, type ContentRules } from "@/core/content/prefs";
import { hasTalkingFootage } from "@/core/brand/footage";
import type { Format } from "@/core/creative/brief";
import type { FunnelStage } from "@/core/plans/types";
import { addDays, safeZone } from "@/lib/zoned-time";

// Everything the Planner reads, loaded in one round of queries.

export interface PlannerContext {
  businessName: string;
  language: string;
  timezone: string;
  /** The client's goals, ranked (first = main) */
  goals: string[];
  /** The client's content choices from onboarding */
  rules: ContentRules;
  /** A usable moment of someone talking to camera in the client's own videos */
  talkingFootage: boolean;
  description: string;
  postsPerWeek: Record<string, number>;
  bibleId: string;
  positioning: string;
  valueProp: string;
  offerStack: { offeringId: string | null; name: string; role: string }[];
  pillars: { id: string; name: string; description: string | null; share: number; funnelStage: FunnelStage | null }[];
  personas: { id: string; name: string; summary: string | null; pains: string[] }[];
  offerings: { id: string; name: string; kind: string; isHero: boolean; priority: number; price: number | null; currency: string | null }[];
  offers: { id: string; offeringId: string | null; title: string; startsAt: string | null; endsAt: string | null }[];
  events: { date: string; name: string; kind: string; relevance: number }[];
  learnings: { dimension: string; value: string; platform: string | null; score: number; sample: number; insight: string | null }[];
  recent: { angle: string | null; offeringId: string | null; hookType: string | null; format: string }[];
}

export async function loadPlannerContext(db: SupabaseClient, weekStart: string): Promise<PlannerContext> {
  const bible = await approvedBible(db);
  const since = new Date(Date.now() - 21 * 86400_000).toISOString();
  const [profile, pillars, personas, offerings, offers, events, learnings, recent] = await Promise.all([
    db.from("business_profile").select("*").single(),
    db.from("content_pillars").select("id, name, description, target_share, funnel_stage").eq("active", true),
    db.from("personas").select("id, name, summary, pains").eq("active", true),
    db.from("offerings").select("id, name, kind, is_hero, priority, price, currency").eq("active", true).order("priority", { ascending: false }),
    db.from("offers").select("id, offering_id, title, starts_at, ends_at").eq("active", true),
    db.from("calendar_events").select("date, name, kind, relevance").gte("date", addDays(weekStart, -3)).lte("date", addDays(weekStart, 10)).order("date"),
    db.from("learnings").select("dimension, value, platform, score, sample_size, insight").neq("dimension", "baseline"),
    db.from("plan_items").select("angle, offering_id, hook_type, format").gte("slot_at", since),
  ]);
  for (const r of [profile, pillars, personas, offerings, offers, events, learnings, recent]) if (r.error) throw r.error;

  const p = profile.data;
  const c = bible.content ?? {};
  return {
    businessName: p.name,
    language: p.language || "en",
    timezone: safeZone(p.timezone),
    goals: contentRules(p).goals,
    rules: contentRules(p),
    talkingFootage: await hasTalkingFootage(db, contentRules(p).people),
    description: p.description ?? "",
    postsPerWeek: (p.posting_prefs?.platforms ?? {}) as Record<string, number>,
    bibleId: bible.id,
    positioning: c.positioning?.text ?? "",
    valueProp: c.value_prop?.text ?? "",
    offerStack: (c.offer_stack ?? []).filter((o: any) => !o.pending).map((o: any) => ({ offeringId: o.offeringId, name: o.name, role: o.role })),
    pillars: (pillars.data ?? []).map((x) => ({ id: x.id, name: x.name, description: x.description, share: Number(x.target_share), funnelStage: x.funnel_stage })),
    personas: (personas.data ?? []).map((x) => ({ id: x.id, name: x.name, summary: x.summary, pains: (x.pains ?? []).slice(0, 3) })),
    offerings: (offerings.data ?? []).map((x) => ({ id: x.id, name: x.name, kind: x.kind, isHero: x.is_hero, priority: x.priority, price: x.price, currency: x.currency })),
    offers: (offers.data ?? []).map((x) => ({ id: x.id, offeringId: x.offering_id, title: x.title, startsAt: x.starts_at, endsAt: x.ends_at })),
    events: (events.data ?? []).map((x) => ({ date: x.date, name: x.name, kind: x.kind, relevance: x.relevance })),
    learnings: (learnings.data ?? []).map((x) => ({
      dimension: x.dimension,
      value: x.value,
      platform: x.platform,
      score: Number(x.score ?? 1),
      sample: x.sample_size ?? 0,
      insight: x.insight,
    })),
    recent: (recent.data ?? []).map((x) => ({ angle: x.angle, offeringId: x.offering_id, hookType: x.hook_type, format: x.format })),
  };
}

/** Format scores the slot planner trusts: at least 5 posts behind them. */
export function formatScores(ctx: PlannerContext): Partial<Record<Format, number>> {
  const out: Partial<Record<Format, number>> = {};
  for (const l of ctx.learnings) {
    if (l.dimension !== "format" || l.platform || l.sample < 5) continue;
    if (["static", "carousel", "video", "text"].includes(l.value)) out[l.value as Format] = l.score;
  }
  return out;
}

/** Style scores the style rotation trusts: at least 5 posts behind them. */
export function styleScores(ctx: PlannerContext): Record<string, number> {
  const out: Record<string, number> = {};
  for (const l of ctx.learnings) if (l.dimension === "style" && !l.platform && l.sample >= 5) out[l.value] = l.score;
  return out;
}

/** Best posting time per platform from learnings (time_slot values are "HH:MM"), when confident. */
export function bestTimes(ctx: PlannerContext): Record<string, string> {
  const out: Record<string, { time: string; score: number }> = {};
  for (const l of ctx.learnings) {
    if (l.dimension !== "time_slot" || !l.platform || l.sample < 10 || !/^\d{2}:\d{2}$/.test(l.value)) continue;
    if (!out[l.platform] || l.score > out[l.platform].score) out[l.platform] = { time: l.value, score: l.score };
  }
  return Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.time]));
}
