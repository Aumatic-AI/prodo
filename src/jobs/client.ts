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
  /** A Brand Bible version was approved (the weekly loop listens from Sprint 2) */
  "brand/approved": { data: { bibleId: string; version: number } };
};

export const inngest = new Inngest({ id: "prodo", schemas: new Map() as any });

export type { Events };
