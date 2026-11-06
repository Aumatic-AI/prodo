import { businessBrief } from "@/agents/research/context";
import { defineResearchAgent } from "@/agents/research/define";
import { optional } from "@/agents/run";
import { readWebsite } from "./read-website";

// Agent 1 · Website Analyst
// Reads the client's website and turns it into Brand Brain chunks and facts waiting for confirmation.
// The onboarding website scan does the same reading earlier; then this agent is marked done at submit.
// A website that is down or can't be read doesn't block the Brand Bible: the agent finishes with a note
// and the research goes on with everything else ("Refresh brand" reads the site once it's back).

export const websiteAnalyst = defineResearchAgent("website_analyst", async ({ db, ctx, task, skipped }) => {
  if (!ctx.website) return "No website given, so nothing to read";
  const read = await optional(readWebsite({ db, website: ctx.website, brief: businessBrief(ctx), task, skipped }), {
    failed: skipped.note("reading the website"),
  });
  if (!read) return "Couldn't read the website, so the research goes on without it";
  const { pages, counts } = read;
  return `Read ${pages.length} pages. Found ${counts.offerings} new products or services, ${counts.offers} offers and ${counts.proof} reviews or proof points for you to confirm`;
});
