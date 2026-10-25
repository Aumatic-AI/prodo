import type { SupabaseClient } from "@supabase/supabase-js";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";

// The Brand Brain passages the Strategist reads: one search per Bible section, merged.

/** What each section needs to know, as a search query. */
export const SECTION_QUERIES: Record<string, string> = {
  positioning: "what the business does, who it serves, and what makes it different",
  value_prop: "main benefit and promise to customers, results they get",
  tone: "how the brand talks to customers, its voice and personality",
  offers: "products, services, prices, packages, deals and guarantees",
  proof: "customer reviews, testimonials, results, awards and numbers",
  audience: "who the customers are, their problems, needs and questions",
  story: "brand story, founders, values and mission",
};

const PER_QUERY = 6;
const MAX_PASSAGES = 36;
const MAX_CHARS = 1200;

export interface Passage {
  id: string;
  text: string;
  title: string | null;
}

export async function findPassages(db: SupabaseClient): Promise<{ passages: Passage[]; usage: Usage }> {
  const queries = Object.values(SECTION_QUERIES);
  const vectors = await ai.embed(queries);

  const results = await Promise.all(
    vectors.data.map((v) =>
      db.rpc("match_brand_chunks", {
        query_embedding: JSON.stringify(v),
        match_count: PER_QUERY,
        // Our own website and posts only; competitor text is never a fact about us
        filter: {},
      })
    )
  );

  const seen = new Set<string>();
  const passages: Passage[] = [];
  // Round-robin across sections so every section gets its best passages in
  for (let rank = 0; rank < PER_QUERY; rank++) {
    for (const res of results) {
      if (res.error) throw res.error;
      const row = (res.data ?? [])[rank];
      if (!row || seen.has(row.id) || row.metadata?.kind === "competitor") continue;
      seen.add(row.id);
      passages.push({ id: row.id, text: row.content.slice(0, MAX_CHARS), title: null });
    }
  }
  return { passages: passages.slice(0, MAX_PASSAGES), usage: vectors.usage };
}
