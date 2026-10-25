import type { GetStepTools } from "inngest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { inngest } from "@/jobs/client";
import type { PlanItem } from "@/core/plans/types";
import type { Task } from "@/agents/weekly/task";

export type Step = GetStepTools<typeof inngest>;

/** What every producer gets for one attempt at a slot. */
export interface ProduceArgs {
  step: Step;
  /** Producer steps, logged against the slot and its media */
  task: Task;
  db: () => SupabaseClient;
  item: PlanItem;
  mediaId: string;
  /** 0 for the first make, 1–2 for QA redos (keeps step ids unique) */
  round: number;
  /** QA's notes for a redo */
  fix: string | null;
}

/** What QA Gate 2 checks afterwards. */
export interface Produced {
  mainKey: string;
  /** Every image to look at (renders, slides), as public URLs */
  previewUrls: string[];
  /** The AI photo behind the design, for the "matches the reference" check */
  photoUrl: string | null;
  referenceUrl: string | null;
  /** Colour pairs the design used, with their contrast */
  contrast: { name: string; ratio: number }[];
  canvases: { ratio: string; width: number; height: number; key: string }[];
  /** Video only */
  durationSec?: number;
  scenes?: { index: number; start: number; end: number; visual: string; voiceover: string }[];
}
