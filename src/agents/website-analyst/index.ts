import { AppError } from "@/core/errors";
import { ai } from "@/providers/ai/registry";
import { optional } from "@/agents/run";
import { embedSources, saveSource } from "@/agents/research/brain";
import { businessBrief } from "@/agents/research/context";
import { defineResearchAgent, inGroups } from "@/agents/research/define";
import { cleanMarkdown, rankPages } from "./rank-pages";
import { extractPageFacts } from "./extract";
import { mergeFacts } from "./merge";

// Agent 1 · Website Analyst
// Reads the client's website and turns it into Brand Brain chunks and facts waiting for confirmation.
// map site → pick pages (code) → read each page → embed changed pages → pull facts per page → merge

const MAX_PAGES = 30;
const PARALLEL = 5;
/** Pages with less text than this (cookie walls, empty templates) are skipped */
const MIN_PAGE_CHARS = 200;

const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || url;

export const websiteAnalyst = defineResearchAgent("website_analyst", async ({ db, ctx, task }) => {
  const website = ctx.website;
  if (!website) return "No website given, so nothing to read";
  const brief = businessBrief(ctx);

  const map = await task(
    "map-site",
    async (track) => {
      const res = await ai.crawl.map(website, 300);
      track(res.usage);
      return {
        total: res.data.length,
        urls: rankPages(website, res.data, MAX_PAGES),
      };
    },
    (r) => `Found ${r.total} pages on ${shortUrl(website)}, picked ${r.urls.length} to read`
  );

  const read = await inGroups(map.urls, PARALLEL, (url, i) =>
    optional(
      task(
        `read-page-${i}`,
        async (track) => {
          const res = await ai.crawl.scrape(url);
          track(res.usage);
          const content = cleanMarkdown(res.data.markdown);
          if (content.length < MIN_PAGE_CHARS) return { sourceId: null, changed: false };
          const saved = await saveSource(db(), {
            kind: "web_page",
            url,
            title: res.data.title,
            content,
          });
          return {
            sourceId: saved.id as string | null,
            changed: saved.changed,
          };
        },
        (r) => (r.sourceId ? `Read ${shortUrl(url)}${r.changed ? "" : " (unchanged)"}` : `Skipped ${shortUrl(url)}: almost no text`)
      )
    )
  );

  const pages = read.flatMap((r) => (r?.sourceId ? [{ sourceId: r.sourceId, changed: r.changed }] : []));
  if (!pages.length) {
    throw new AppError(`We couldn't read any page of ${shortUrl(website)}. Check the website address in Basics, then retry.`, "INVALID_INPUT", false);
  }
  const changed = pages.filter((p) => p.changed).map((p) => p.sourceId);

  if (changed.length) {
    await task(
      "embed-pages",
      async (track) => {
        const res = await embedSources(db(), changed, () => ({
          origin: "website",
        }));
        track(res.usage);
        return { chunks: res.chunks };
      },
      (r) => `Saved ${r.chunks} passages to the Brand Brain`
    );
  }

  // Unchanged pages keep the facts found last time
  await inGroups(changed, PARALLEL, (sourceId, i) =>
    optional(
      task(
        `extract-facts-${i}`,
        async (track) => {
          const res = await extractPageFacts(db(), sourceId, brief);
          track(res.usage);
          return res.facts;
        },
        (r) => `Found ${r.offerings} offerings, ${r.offers} offers and ${r.proof} reviews or proof points on one page`
      )
    )
  );

  // Every page's facts are merged together (unchanged pages keep the facts found last time)
  const merged = await task(
    "merge-facts",
    async (track) => {
      const res = await mergeFacts(
        db(),
        pages.map((p) => p.sourceId)
      );
      if (res.usage) track(res.usage);
      return res.counts;
    },
    (r) => `${r.offerings} products or services, ${r.offers} offers and ${r.proof} reviews to confirm${r.repeats ? ` (${r.repeats} repeats left out)` : ""}`
  );

  return `Read ${pages.length} pages. Found ${merged.offerings} new products or services, ${merged.offers} offers and ${merged.proof} reviews or proof points for you to confirm`;
});
