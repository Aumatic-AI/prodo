import type { SupabaseClient } from "@supabase/supabase-js";
import { readResearch, STRATEGIST, type AgentState } from "@/core/onboarding/research";
import { getCurrent, listVersions, type BibleVersion, type BibleVersionSummary } from "./bible";

export interface BibleOverview {
  approved: BibleVersion | null;
  draft: BibleVersion | null;
  versions: BibleVersionSummary[];
  /** The Strategist's state: running or queued while a draft is being written */
  strategist: AgentState | null;
  /** Facts from the website waiting for the client */
  pendingCount: number;
}

export async function loadBibleOverview(db: SupabaseClient): Promise<BibleOverview> {
  const [current, versions, { research }, pending] = await Promise.all([
    getCurrent(db),
    listVersions(db),
    readResearch(db),
    Promise.all([
      db.from("offerings").select("id", { count: "exact", head: true }).eq("verified", false),
      db.from("offers").select("id", { count: "exact", head: true }).eq("verified", false),
      db.from("proof_items").select("id", { count: "exact", head: true }).eq("verified", false),
    ]),
  ]);
  return {
    ...current,
    versions,
    strategist: research?.agents[STRATEGIST] ?? null,
    pendingCount: pending.reduce((sum, r) => sum + (r.count ?? 0), 0),
  };
}
