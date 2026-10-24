import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/config/models";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";
import { PAGE_FACTS_SYSTEM, pageFactsPrompt, pageFactsSchema, type PageFacts } from "@/prompts/agents/website-facts";

/**
 * Pulls offerings, offers and proof out of one saved page and keeps them on the source
 * (brand_sources.metadata.facts), so the merge can run again later without paying for it twice.
 */
export async function extractPageFacts(
  db: SupabaseClient,
  sourceId: string,
  brief: string
): Promise<{
  facts: { offerings: number; offers: number; proof: number };
  usage: Usage;
}> {
  const { data: source, error } = await db.from("brand_sources").select("url, title, content_md, metadata").eq("id", sourceId).single();
  if (error) throw error;

  const res = await ai.structured(
    pageFactsSchema,
    pageFactsPrompt(
      {
        url: source.url,
        title: source.title,
        markdown: source.content_md ?? "",
      },
      brief
    ),
    {
      system: PAGE_FACTS_SYSTEM,
      model: MODELS.extract,
    }
  );

  const facts: PageFacts = res.data;
  const { error: saveError } = await db
    .from("brand_sources")
    .update({ metadata: { ...(source.metadata ?? {}), facts } })
    .eq("id", sourceId);
  if (saveError) throw saveError;

  return {
    facts: {
      offerings: facts.offerings.length,
      offers: facts.offers.length,
      proof: facts.proof.length,
    },
    usage: res.usage,
  };
}
