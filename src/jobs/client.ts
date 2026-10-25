import { Inngest } from "inngest";
import type { ResearchAgent } from "@/core/onboarding/research";

type Events = {
  "media/generate-image": { data: { mediaId: string } };
  "media/generate-video": { data: { mediaId: string } };
  "post/publish": { data: { postId: string } };
  "post/check-status": { data: { postId: string; checkAt: string } };
  "post/cancelled": { data: { postId: string } };
  "media/deleted": { data: { mediaId: string } };
  /** Brand research. `agents` lists which ones to run (all on submit, the unfinished ones on retry). */
  "onboarding/started": { data: { runId: string; attempt: string; agents: ResearchAgent[] } };
  /** New Brand Bible draft from the same research, following the client's note */
  "brand/regenerate": { data: { runId: string; note: string | null } };
  /** A Brand Bible version was approved */
  "brand/approved": { data: { bibleId: string; version: number } };

  // ---------- Weekly loop ----------
  /** Plan the week starting on weekStart (Monday, "YYYY-MM-DD"); from the weekly cron or "Plan next week" */
  "plan/requested": { data: { weekStart: string; replace?: boolean; source: "cron" | "client" | "onboarding" } };
  /** Make one slot: Creative Director → QA Gate 1 → Producer → QA Gate 2. `note` = the client's regenerate note */
  "plan-item/produce": { data: { itemId: string; planId: string; note?: string | null; oneOff?: boolean } };
  /** A slot finished producing (ready, needs review or failed) */
  "plan-item/settled": { data: { itemId: string; planId: string; oneOff?: boolean } };
  /** Every slot of a plan finished producing and the client was told */
  "plan/review-started": { data: { planId: string } };
  /** The client (or full autopilot) approved a plan: schedule its approved slots */
  "plan/approved": { data: { planId: string; auto?: boolean } };
  /** One slot approved: schedule it */
  "plan-item/approved": { data: { itemId: string } };
  /** Run the weekly learning now (also runs every Sunday) */
  "performance/learn": { data: Record<string, never> };
  /** The pause switch changed: hold or release posts already scheduled with the provider */
  "settings/paused-changed": { data: { paused: boolean } };
  /** A slot was rejected, deleted or replanned: stop work on it */
  "plan-item/cancelled": { data: { itemId: string } };
};

export const inngest = new Inngest({ id: "prodo", schemas: new Map() as any });

export type { Events };
