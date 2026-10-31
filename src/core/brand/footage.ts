import type { SupabaseClient } from "@supabase/supabase-js";
import type { PeopleChoice } from "@/core/onboarding/options";
import type { FootageAnalysis, FootageMoment } from "@/prompts/agents/footage";

// The client's own video moments, as logged by agents/footage (brand_assets.analysis). Read by the
// Planner (is there talking footage?) and the Creative Director (which moments a scene can use).

const FOOTAGE_KINDS = ["general", "product_photo", "team", "location", "work", "person"];
/** Moments below this quality (1–5) aren't offered */
const MIN_QUALITY = 3;

export interface Moment extends FootageMoment {
  assetId: string;
  offeringId: string | null;
  /** The whole video's orientation, for cropping */
  orientation: FootageAnalysis["orientation"];
  storageKey: string;
}

/**
 * Usable moments of the client's own videos, best first: this offering's first, then the rest.
 * The people choice applies: no people means no moment with a person in it.
 */
export async function loadMoments(db: SupabaseClient, opts: { offeringId?: string | null; people?: PeopleChoice | null; max?: number } = {}): Promise<Moment[]> {
  const { data, error } = await db.from("brand_assets").select("id, offering_id, storage_key, analysis").in("kind", FOOTAGE_KINDS).not("analysis", "is", null).limit(40);
  if (error) throw error;
  const moments = (data ?? []).flatMap((a) => {
    const analysis = a.analysis as (FootageAnalysis & { error?: string }) | null;
    if (!analysis || analysis.error) return [];
    return (analysis.moments ?? []).map((m) => ({ ...m, assetId: a.id, offeringId: a.offering_id, orientation: analysis.orientation, storageKey: a.storage_key }));
  });
  return moments
    .filter((m) => m.quality >= MIN_QUALITY)
    .filter((m) => opts.people !== "none" || (m.people === "none" || m.people === "hands"))
    .sort((x, y) => Number(y.offeringId === opts.offeringId) - Number(x.offeringId === opts.offeringId) || Number(y.talking) - Number(x.talking) || y.quality - x.quality)
    .slice(0, opts.max ?? 16);
}

/** True when the client has a usable moment of someone talking to camera. */
export async function hasTalkingFootage(db: SupabaseClient, people: PeopleChoice | null): Promise<boolean> {
  if (people === "none") return false;
  return (await loadMoments(db, { people, max: 40 })).some((m) => m.talking && m.lines.length > 0);
}

/** What the client's reference videos do well (Social & Market Analyst), for the Creative Director to learn pacing from. */
export async function referenceLessons(db: SupabaseClient, max = 3): Promise<string[]> {
  const { data } = await db.from("brand_sources").select("metadata").eq("kind", "reference").limit(10);
  return (data ?? [])
    .map((r) => (r.metadata as { lesson?: string } | null)?.lesson)
    .filter((l): l is string => !!l)
    .slice(0, max);
}
