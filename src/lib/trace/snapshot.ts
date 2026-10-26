import type { SupabaseClient } from "@supabase/supabase-js";
import { emit, enabled, mute } from "./core";

// Row counts at the start and end of a run, so the report can show what the run added.

const TABLES = [
  "brand_sources",
  "brand_chunks",
  "offerings",
  "offers",
  "proof_items",
  "competitors",
  "learnings",
  "hook_library",
  "brand_bible",
  "personas",
  "content_pillars",
  "calendar_events",
  "agent_runs",
];

async function count(db: SupabaseClient, table: string, filter?: [string, string | boolean]): Promise<number | null> {
  let query = db.from(table).select("*", { count: "exact", head: true });
  if (filter) query = query.eq(filter[0], filter[1]);
  const { count: n } = await query;
  return n ?? null;
}

export async function snapshot(db: SupabaseClient, phase: "start" | "end"): Promise<void> {
  if (!enabled) return;
  try {
    const data = await mute(async () => {
      const counts = Object.fromEntries(await Promise.all(TABLES.map(async (t) => [t, await count(db, t)] as const)));
      const [pendingOfferings, pendingOffers, pendingProof, discovered, kit] = await Promise.all([
        count(db, "offerings", ["verified", false]),
        count(db, "offers", ["verified", false]),
        count(db, "proof_items", ["verified", false]),
        count(db, "competitors", ["source", "discovered"]),
        db.from("brand_kit").select("colors, fonts, logo_variants, photo_style, layout_style").maybeSingle(),
      ]);
      return { counts, waiting: { pendingOfferings, pendingOffers, pendingProof, discovered }, kit: kit.data };
    });
    emit("snapshot", { phase, ...data });
  } catch {
    // best effort
  }
}
