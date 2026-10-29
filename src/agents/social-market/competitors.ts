import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/config/models";
import { ai, type AdCreative, type WebResult } from "@/providers/ai/registry";
import { domainOf, handleFromUrl } from "@/providers/social/handles";
import type { Usage } from "@/providers/usage";
import {
  COMPETITOR_ANALYSIS_SYSTEM,
  COMPETITOR_PICKS_SYSTEM,
  competitorAnalysisPrompt,
  competitorAnalysisSchema,
  competitorPicksPrompt,
  competitorPicksSchema,
  type CompetitorAnalysis,
} from "@/prompts/agents/competitors";
import { saveSource } from "@/agents/research/brain";
import type { ResearchContext } from "@/agents/research/context";
import { nameKey } from "@/agents/research/text";
import { scorePosts } from "./baseline";

// Competitors: find them when the client named fewer than two, read their public footprint
// (website, Instagram, Meta and Google ads), then summarise it. Their claims stay theirs:
// stored on the competitor, never as our facts.

export const MIN_COMPETITORS = 2;
export const MAX_COMPETITORS = 5;

export interface Competitor {
  id: string;
  name: string;
  website: string | null;
  socialUrls: Record<string, string>;
  /** A brand the client admires: only its posts are studied, for look and hooks */
  inspiration?: boolean;
}

/** ScrapeCreators wants "UK" for the United Kingdom; everything else is the ISO code. */
const searchRegion = (country: string | undefined) => (country === "GB" ? "UK" : country);

// ---------- Discovery ----------

/** Two searches built from the client's answers, e.g. "best teeth whitening London". */
export function discoveryQueries(ctx: ResearchContext): string[] {
  const place = ctx.cities.split(",")[0]?.trim() || ctx.countryNames[0] || "";
  const offerings = ctx.offerings.slice(0, 2).map((o) => o.name);
  const queries = offerings.map((name) => `best ${name} ${place}`.trim());
  if (queries.length < 2) queries.push(`${ctx.name} competitors ${place}`.trim());
  return [...new Set(queries)].slice(0, 2);
}

export async function searchForCompetitors(ctx: ResearchContext): Promise<{ results: WebResult[]; usage: Usage[] }> {
  const region = searchRegion(ctx.countries[0]);
  const responses = await Promise.all(discoveryQueries(ctx).map((q) => ai.search.google(q, region)));
  const seen = new Set<string>();
  const results = responses
    .flatMap((r) => r.data)
    .filter((r) => {
      const key = r.url.split("?")[0];
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 20);
  return { results, usage: responses.map((r) => r.usage) };
}

/** AI picks real competitors from the results; they're saved as "discovered" so the client can remove them. */
export async function saveDiscovered(
  db: SupabaseClient,
  ctx: ResearchContext,
  results: WebResult[],
  brief: string,
  wanted: number
): Promise<{ added: Competitor[]; usage: Usage | null }> {
  if (!results.length || wanted <= 0) return { added: [], usage: null };
  const known = ctx.competitors.map((c) => c.name);
  const res = await ai.structured(competitorPicksSchema, competitorPicksPrompt(brief, results, [ctx.name, ...known]), {
    system: COMPETITOR_PICKS_SYSTEM,
    model: MODELS.analyze,
  });

  const ownDomain = domainOf(ctx.website);
  const knownKeys = new Set([ctx.name, ...known].map(nameKey));
  const knownDomains = new Set(ctx.competitors.map((c) => domainOf(c.website)).filter(Boolean));
  const rows = res.data.competitors
    .filter((c) => {
      const domain = domainOf(c.website);
      return !knownKeys.has(nameKey(c.name)) && (!domain || (domain !== ownDomain && !knownDomains.has(domain)));
    })
    .slice(0, wanted)
    .map((c) => ({
      name: c.name,
      website: c.website,
      social_urls: {},
      source: "discovered",
    }));

  if (!rows.length) return { added: [], usage: res.usage };
  const { data, error } = await db.from("competitors").insert(rows).select("id, name, website, social_urls");
  if (error) throw error;
  return {
    added: (data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
      socialUrls: c.social_urls ?? {},
    })),
    usage: res.usage,
  };
}

// ---------- Public footprint ----------

interface AdNote {
  network: AdCreative["network"];
  text?: string;
  title?: string;
  cta?: string;
  format?: string;
  firstShown?: string;
  videoUrl?: string;
}

export interface CompetitorPost {
  url?: string;
  caption?: string;
  mediaType: string;
  views: number | null;
  score: number | null;
  videoUrl?: string;
}

/** Everything read about one competitor, trimmed to what the summary needs. */
export interface Footprint {
  instagram: string | null;
  followers: number | null;
  posts: CompetitorPost[];
  metaAds: AdNote[];
  googleAds: AdNote[];
  homepage: string | null;
}

const trimAd = (a: AdCreative): AdNote => ({
  network: a.network,
  text: a.text?.slice(0, 400),
  title: a.title?.slice(0, 120),
  cta: a.cta,
  format: a.format,
  firstShown: a.firstShown,
  videoUrl: a.videoUrl,
});

/** Meta Ad Library: finds the competitor's page by name (which also gives their Instagram) and its active ads. */
export async function readMetaAds(competitor: Competitor, country: string | undefined) {
  const usage: Usage[] = [];
  const search = await ai.ads.metaAdvertisers(competitor.name);
  usage.push(search.usage);
  const key = nameKey(competitor.name);
  const match = search.data.find((m) => nameKey(m.name) === key) ?? search.data.find((m) => nameKey(m.name).includes(key) || key.includes(nameKey(m.name)));
  if (!match) return { instagram: null, ads: [] as AdNote[], usage };
  let ads = await ai.ads.meta(match.pageId, country);
  usage.push(ads.usage);
  // No ads in the client's country: what they run elsewhere still shows what sells
  if (!ads.data.length && country) {
    ads = await ai.ads.meta(match.pageId);
    usage.push(ads.usage);
  }
  return {
    instagram: match.instagram ?? null,
    ads: ads.data.slice(0, 12).map(trimAd),
    usage,
  };
}

export async function readGoogleAds(website: string | null) {
  const domain = domainOf(website);
  if (!domain) return { ads: [] as AdNote[], usage: [] as Usage[] };
  const res = await ai.ads.google(domain);
  return { ads: res.data.slice(0, 12).map(trimAd), usage: [res.usage] };
}

export async function readInstagram(handle: string) {
  const [profile, list] = await Promise.all([ai.social.profile("instagram", handle), ai.social.posts("instagram", handle, 30)]);
  const followers = profile.data?.followers ?? null;
  const { posts } = scorePosts("instagram", list.data, followers);
  // Their best posts by engagement (the top 20% alone is often only 2 or 3 posts)
  const best = [...posts].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)).slice(0, 8);
  return {
    followers,
    posts: best.map((p) => ({
      url: p.url,
      caption: p.caption?.slice(0, 300),
      mediaType: p.mediaType,
      views: p.views,
      score: p.score,
      videoUrl: p.videoUrl,
    })),
    usage: [profile.usage, list.usage],
  };
}

export async function readHomepage(website: string | null) {
  if (!website) return { text: null, usage: [] as Usage[] };
  const res = await ai.crawl.scrape(website);
  return { text: res.data.markdown.slice(0, 5000), usage: [res.usage] };
}

/**
 * The competitor's longest-running video ad: an ad kept running for months is one that sells,
 * so it's the best one to watch. Null when none of their ads is a video.
 */
export function longestRunningVideoAd(ads: AdNote[]): AdNote | null {
  const videos = ads.filter((a) => a.videoUrl && a.firstShown);
  return videos.sort((a, b) => Date.parse(a.firstShown!) - Date.parse(b.firstShown!))[0] ?? null;
}

/** Instagram handle the client gave for this competitor, if any. */
export const givenInstagram = (c: Competitor) => handleFromUrl("instagram", c.socialUrls.instagram);

// ---------- Summary ----------

function researchText(f: Footprint): string {
  const parts: string[] = [];
  if (f.homepage) parts.push(`Website (homepage):\n${f.homepage}`);
  if (f.posts.length) {
    parts.push(
      `Instagram${f.instagram ? ` @${f.instagram}` : ""}${f.followers ? `, ${f.followers} followers` : ""}. Best posts:\n` +
        f.posts.map((p) => `- [${p.mediaType}${p.views ? `, ${p.views} views` : ""}] ${p.caption?.replace(/\s+/g, " ") ?? ""}`).join("\n")
    );
  }
  const ads = [...f.metaAds, ...f.googleAds];
  if (ads.length) {
    parts.push(
      `Active ads (${f.metaAds.length} on Meta, ${f.googleAds.length} on Google):\n` +
        ads
          .map((a) => `- [${a.network}${a.format ? ` ${a.format}` : ""}] ${[a.title, a.text, a.cta && `CTA: ${a.cta}`].filter(Boolean).join(" | ")}`)
          .join("\n")
    );
  }
  return parts.join("\n\n") || "No public data found.";
}

/** Summarises the footprint into competitors.analysis and keeps the raw research as a competitor source. */
export async function summarizeCompetitor(
  db: SupabaseClient,
  competitor: Competitor,
  footprint: Footprint,
  brief: string
): Promise<{ analysis: CompetitorAnalysis; usage: Usage }> {
  const research = researchText(footprint);
  const res = await ai.structured(competitorAnalysisSchema, competitorAnalysisPrompt(brief, competitor.name, research), {
    system: COMPETITOR_ANALYSIS_SYSTEM,
    model: MODELS.analyze,
  });

  await saveSource(db, {
    kind: "competitor",
    url: competitor.website ?? `competitor:${competitor.id}`,
    title: competitor.name,
    content: research,
    competitorId: competitor.id,
    metadata: {
      followers: footprint.followers,
      metaAds: footprint.metaAds.length,
      googleAds: footprint.googleAds.length,
    },
  });

  const socialUrls = {
    ...competitor.socialUrls,
    ...(footprint.instagram && !competitor.socialUrls.instagram ? { instagram: `https://www.instagram.com/${footprint.instagram}/` } : {}),
  };
  const { error } = await db
    .from("competitors")
    .update({
      analysis: {
        ...res.data,
        followers: footprint.followers,
        activeAds: {
          meta: footprint.metaAds.length,
          google: footprint.googleAds.length,
        },
      },
      analyzed_at: new Date().toISOString(),
      social_urls: socialUrls,
    })
    .eq("id", competitor.id);
  if (error) throw error;
  return { analysis: res.data, usage: res.usage };
}
