import { EventSchemas, Inngest } from "inngest";
import type { ResearchAgent } from "@/core/onboarding/research";

// Every event carries the business it is for: functions open the database with businessDb(businessId),
// and per-business limits (concurrency) key on it. The types make a missing businessId a compile error.

type ForBusiness<T extends object = Record<never, never>> = { data: T & { businessId: string } };

type Events = {
  "media/generate-image": ForBusiness<{ mediaId: string }>;
  "media/generate-video": ForBusiness<{ mediaId: string }>;
  "post/publish": ForBusiness<{ postId: string }>;
  "post/check-status": ForBusiness<{ postId: string; checkAt: string }>;
  "post/cancelled": ForBusiness<{ postId: string }>;
  "media/deleted": ForBusiness<{ mediaId: string }>;
  /** Brand research. `agents` lists which ones to run (all on submit, the unfinished ones on retry). */
  "onboarding/started": ForBusiness<{ runId: string; attempt: string; agents: ResearchAgent[] }>;
  /** One research agent, started by the onboarding run (step.invoke) */
  "research/website-analyst": ForBusiness<{ runId: string; note?: string | null }>;
  "research/visual-identity-analyst": ForBusiness<{ runId: string; note?: string | null }>;
  "research/social-market-analyst": ForBusiness<{ runId: string; note?: string | null }>;
  "research/brand-strategist": ForBusiness<{ runId: string; note?: string | null }>;
  /** New Brand Bible draft from the same research, following the client's note */
  "brand/regenerate": ForBusiness<{ runId: string; note: string | null }>;
  /** A Brand Bible version was approved */
  "brand/approved": ForBusiness<{ bibleId: string; version: number }>;

  // ---------- Weekly loop ----------
  /** Hourly from the cron, per business: plan next week if it's the business's plan day and hour */
  "plan/check-due": ForBusiness;
  /** Plan the week starting on weekStart (Monday, "YYYY-MM-DD"); from the weekly cron or "Plan next week" */
  "plan/requested": ForBusiness<{ weekStart: string; replace?: boolean; source: "cron" | "client" | "onboarding" }>;
  /** Make one slot: Creative Director → QA Gate 1 → Producer → QA Gate 2. `note` = the client's regenerate note */
  "plan-item/produce": ForBusiness<{ itemId: string; planId: string; note?: string | null; oneOff?: boolean }>;
  /** A slot finished producing (ready, needs review or failed) */
  "plan-item/settled": ForBusiness<{ itemId: string; planId: string; oneOff?: boolean }>;
  /** Every slot of a plan finished producing and the client was told */
  "plan/review-started": ForBusiness<{ planId: string }>;
  /** The client (or full autopilot) approved a plan: schedule its approved slots */
  "plan/approved": ForBusiness<{ planId: string; auto?: boolean }>;
  /** One slot approved: schedule it */
  "plan-item/approved": ForBusiness<{ itemId: string }>;
  /** Daily metrics and follower counts (from the cron, per business) */
  "performance/sync": ForBusiness;
  /** The weekly learning (from the Sunday cron per business, or "Learn now") */
  "performance/learn": ForBusiness;
  /** Monthly: public holidays and a fresh market read (from the cron, per business) */
  "brand/monthly-refresh": ForBusiness;
  /** The pause switch changed: hold or release posts already scheduled with the provider */
  "settings/paused-changed": ForBusiness<{ paused: boolean }>;
  /** A slot was rejected, deleted or replanned: stop work on it */
  "plan-item/cancelled": ForBusiness<{ itemId: string }>;
};

export const inngest = new Inngest({ id: "prodo", schemas: new EventSchemas().fromRecord<Events>() });

export type { Events };
