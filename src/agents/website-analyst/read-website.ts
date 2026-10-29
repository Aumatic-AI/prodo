import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { request } from "@/providers/http";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";
import { optional } from "@/agents/run";
import { embedSources, saveSource } from "@/agents/research/brain";
import { inGroups } from "@/agents/research/define";
import { cleanMarkdown, rankPages } from "./rank-pages";
import { extractPageFacts } from "./extract";
import { mergeFacts, type FoundOffering, type MergeCounts } from "./merge";

// Reads the client's website into the Brand Brain and turns it into facts waiting for confirmation.
// Used by the Website Analyst (research) and by the onboarding website scan.
// map site → pick pages (code) → read each page → embed changed pages → pull facts per page → merge

const MAX_PAGES = 15;
const PARALLEL = 5;
/** Pages with less text than this (cookie walls, empty templates) are skipped */
const MIN_PAGE_CHARS = 200;

type Track = (usage: Usage | Usage[]) => void;
export type Task = <T>(id: string, fn: (track: Track) => Promise<T>, summary?: (result: T) => string) => Promise<T>;

export interface WebsiteRead {
  /** Pages read, best first (brand_sources ids) */
  pages: string[];
  counts: MergeCounts;
  /** New offerings found, with their photo links */
  found: FoundOffering[];
}

/** Pages checked for removal per read */
const MAX_GONE_CHECKS = 20;

/** Host and path without www, scheme or trailing slash, so the same page always compares equal. */
const pageKey = (url: string) =>
  url
    .replace(/^https?:\/\/(www\.)?/i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .toLowerCase();

export const shortUrl = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "") || url;

export async function readWebsite({ db, website, brief, task }: { db: () => SupabaseClient; website: string; brief: string; task: Task }): Promise<WebsiteRead> {
  const map = await task(
    "map-site",
    async (track) => {
      const res = await ai.crawl.map(website, 300);
      track(res.usage);
      return {
        total: res.data.length,
        urls: rankPages(website, res.data, MAX_PAGES),
        all: res.data.map((l) => pageKey(l.url)),
      };
    },
    (r) => `Found ${r.total} pages on ${shortUrl(website)}, picked ${r.urls.length} to read`
  );

  // Pages read before that the site no longer has: their passages leave the Brand Brain
  if (map.all.length) {
    await optional(
      task(
        "remove-deleted-pages",
        async () => {
          const listed = new Set(map.all);
          const { data, error } = await db().from("brand_sources").select("id, url").eq("kind", "web_page");
          if (error) throw error;
          const missing = (data ?? []).filter((s) => s.url && !listed.has(pageKey(s.url))).slice(0, MAX_GONE_CHECKS);
          // Not in the site map isn't enough (maps are partial): the page must answer "not found"
          const gone: string[] = [];
          await inGroups(missing, PARALLEL, async (s) => {
            const res = await request("The website", s.url!, { method: "HEAD" }, 15_000).catch(() => null);
            if (res && (res.status === 404 || res.status === 410)) gone.push(s.id);
          });
          if (gone.length) {
            // Its passages go with it (cascade); facts found on it keep their row, without the source
            const { error: deleteError } = await db().from("brand_sources").delete().in("id", gone);
            if (deleteError) throw deleteError;
          }
          return gone.length;
        },
        (n) => (n ? `Removed ${n} page${n === 1 ? "" : "s"} your website no longer has` : "No pages were removed from your website")
      )
    );
  }

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

  // Every page's facts are merged together
  const merged = await task(
    "merge-facts",
    async (track) => {
      const res = await mergeFacts(
        db(),
        pages.map((p) => p.sourceId)
      );
      if (res.usage) track(res.usage);
      return { counts: res.counts, found: res.found };
    },
    (r) => `${r.counts.offerings} products or services, ${r.counts.offers} offers and ${r.counts.proof} reviews to confirm${r.counts.repeats ? ` (${r.counts.repeats} repeats left out)` : ""}`
  );

  return { pages: pages.map((p) => p.sourceId), counts: merged.counts, found: merged.found };
}
