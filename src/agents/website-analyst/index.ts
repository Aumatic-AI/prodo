import { businessBrief } from "@/agents/research/context";
import { defineResearchAgent } from "@/agents/research/define";
import { readWebsite } from "./read-website";

// Agent 1 · Website Analyst
// Reads the client's website and turns it into Brand Brain chunks and facts waiting for confirmation.
// The onboarding website scan does the same reading earlier; then this agent is marked done at submit.

export const websiteAnalyst = defineResearchAgent("website_analyst", async ({ db, ctx, task }) => {
  if (!ctx.website) return "No website given, so nothing to read";
  const { pages, counts } = await readWebsite({ db, website: ctx.website, brief: businessBrief(ctx), task });
  return `Read ${pages.length} pages. Found ${counts.offerings} new products or services, ${counts.offers} offers and ${counts.proof} reviews or proof points for you to confirm`;
});
