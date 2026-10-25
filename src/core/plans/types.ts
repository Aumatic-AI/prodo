import type { Brief, Format, Lever } from "@/core/creative/brief";

// A weekly plan (content_plans) and its slots (plan_items). See docs/database.md.

export type PlanStatus = "planning" | "producing" | "review" | "approved" | "scheduled" | "done" | "failed";

export type ItemStatus =
  | "planned"
  | "briefed"
  | "producing"
  | "qa"
  /** Passed both QA gates, waiting for the client */
  | "ready"
  /** QA still failed after two redos; the reason is in qa_report */
  | "needs_review"
  | "approved"
  | "rejected"
  | "scheduled"
  | "published"
  | "failed";

export type FunnelStage = "tofu" | "mofu" | "bofu";

export interface PlanStrategy {
  /** Made only to hold single ads ("Create an ad"); the weekly Planner still plans this week and keeps them */
  adhoc?: boolean;
  theme?: string;
  rationale?: string;
  /** Slots per pillar, planned against the target shares */
  mix?: { pillarId: string; name: string; target: number; planned: number }[];
  /** Calendar dates the plan works around */
  events?: string[];
}

export interface ContentPlan {
  id: string;
  week_start: string;
  brand_bible_id: string | null;
  status: PlanStatus;
  strategy: PlanStrategy;
  approved_at: string | null;
  approval_due_at: string | null;
  error: string | null;
  created_at: string;
}

export interface QaCheck {
  name: string;
  passed: boolean;
  detail?: string;
}

export interface QaReport {
  gate1?: { score: number; notes: string; scores?: Record<string, number>; attempts: number };
  gate2?: { score: number; notes: string; checks: QaCheck[]; redone?: string[]; attempts: number };
  /** Plain reason shown when the item needs review */
  reason?: string;
}

export interface PlanItem {
  id: string;
  plan_id: string;
  slot_at: string;
  platforms: string[];
  format: Format;
  pillar_id: string | null;
  persona_id: string | null;
  offering_id: string | null;
  offer_id: string | null;
  funnel_stage: FunnelStage | null;
  objective: string | null;
  angle: string | null;
  framework: string | null;
  hook_type: string | null;
  hook_text: string | null;
  levers: Lever[];
  is_experiment: boolean;
  brief: Brief | null;
  captions: Record<string, string> | null;
  rationale: string | null;
  brief_score: number | null;
  qa_score: number | null;
  qa_report: QaReport | null;
  attempts: number;
  status: ItemStatus;
  selected_media_id: string | null;
  error: string | null;
  created_at: string;
  updated_at: string;
}

/** A slot with the names the screens show, joined in one query. */
export interface PlanItemView extends PlanItem {
  pillar: { name: string } | null;
  persona: { name: string } | null;
  offering: { name: string } | null;
  offer: { title: string } | null;
  media: { id: string; type: string; status: string; storage_key: string | null; error: string | null; cost_usd: number } | null;
  post: { id: string; status: string } | null;
}

export interface PlanView extends ContentPlan {
  items: PlanItemView[];
  costUsd: number;
}

/** Statuses where the agents are still working on a slot. */
export const WORKING: ItemStatus[] = ["planned", "briefed", "producing", "qa"];
/** Statuses that wait for the client. */
export const WAITING: ItemStatus[] = ["ready", "needs_review"];
/** Statuses that count as finished for the plan. */
export const SETTLED: ItemStatus[] = ["ready", "needs_review", "approved", "rejected", "scheduled", "published", "failed"];
