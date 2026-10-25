import { env } from "@/config/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { publisherFor } from "@/providers/publishing/registry";
import { urlFor } from "@/providers/storage/supabase-storage";
import { optional } from "@/agents/run";
import { embedSources } from "@/agents/research/brain";
import { businessBrief } from "@/agents/research/context";
import { defineResearchAgent, inGroups } from "@/agents/research/define";
import { saveBaselines } from "./baseline";
import {
  givenInstagram,
  MAX_COMPETITORS,
  MIN_COMPETITORS,
  readGoogleAds,
  readHomepage,
  readInstagram,
  readMetaAds,
  saveDiscovered,
  searchForCompetitors,
  summarizeCompetitor,
  type Competitor,
  type Footprint,
} from "./competitors";
import { analyzeVideo, MAX_COMPETITOR_VIDEOS, MAX_OWN_VIDEOS, saveHooks, type AnalyzedVideo, type HookPost, type VideoToAnalyze } from "./hooks";
import { ownSources, readOwnPlatform, type PlatformResult } from "./own-posts";

// Agent 3 · Social & Market Analyst
// Learns what already works for the client and for competitors.
// own posts (Zernio or public) → baselines (code) → competitors (find, read, summarise)
// → videos (Twelve Labs) → hooks (AI) into hook_library

const PARALLEL = 3;

export const socialMarketAnalyst = defineResearchAgent("social_market_analyst", async ({ ctx, task }) => {
  const db = () => createAdminClient();
  const brief = businessBrief(ctx);
  const country = ctx.countries[0];

  // ---- The client's own posts ----
  const accounts = await task(
    "list-connected-accounts",
    async () => (await optional(publisherFor().listAccounts())) ?? [],
    (r) => (r.length ? `${r.length} connected account${r.length === 1 ? "" : "s"}` : "No connected accounts; reading public profiles instead")
  );

  const platforms = (
    await inGroups(ownSources(accounts, ctx.socials), PARALLEL, (source, i) =>
      optional(
        task(
          `own-posts-${i}`,
          async (track) => {
            const res = await readOwnPlatform(db(), source);
            track(res.usage);
            return res.result;
          },
          (r) =>
            r
              ? `Read ${r.posts} ${r.platform} posts from ${r.label}${r.baseline.sampleSize < 10 ? " (too few for a reliable average)" : ""}`
              : `No public posts found for ${source.platform}`
        )
      )
    )
  ).filter((r): r is PlatformResult => !!r);

  if (platforms.length) {
    await task(
      "save-baselines",
      async (track) => {
        const rows = await saveBaselines(
          db(),
          platforms.map((p) => p.baseline)
        );
        // Captions show how the brand already talks; the Strategist searches them
        const { data } = await db().from("brand_sources").select("id").eq("kind", "social_post");
        const embedded = await embedSources(
          db(),
          (data ?? []).map((s) => s.id),
          () => ({ origin: "own_social" })
        );
        track(embedded.usage);
        return { rows, platforms: platforms.length };
      },
      (r) => `Worked out the average engagement on ${r.platforms} platform${r.platforms === 1 ? "" : "s"}`
    );
  }

  // ---- Competitors ----
  let competitors: Competitor[] = ctx.competitors.map(({ id, name, website, socialUrls }) => ({
    id,
    name,
    website,
    socialUrls,
  }));
  const named = ctx.competitors.filter((c) => !c.discovered).length;
  if (named < MIN_COMPETITORS) {
    const found = await optional(
      task(
        "search-competitors",
        async (track) => {
          const res = await searchForCompetitors(ctx);
          track(res.usage);
          return res.results;
        },
        (r) => `Searched Google and got ${r.length} results`
      )
    );
    const added = found?.length
      ? await optional(
          task(
            "pick-competitors",
            async (track) => {
              const res = await saveDiscovered(db(), ctx, found ?? [], brief, MIN_COMPETITORS + 1 - ctx.competitors.length);
              if (res.usage) track(res.usage);
              return res.added;
            },
            (r) => (r.length ? `Found competitors: ${r.map((c) => c.name).join(", ")}` : "No clear competitors in the search results")
          )
        )
      : null;
    competitors = [...competitors, ...(added ?? [])];
  }
  competitors = competitors.slice(0, MAX_COMPETITORS);

  const footprints = await inGroups(competitors, PARALLEL, async (c, i) => {
    const meta = await optional(
      task(
        `competitor-${i}-meta-ads`,
        async (track) => {
          const res = await readMetaAds(c, country);
          track(res.usage);
          return { instagram: res.instagram, ads: res.ads };
        },
        (r) => `${c.name}: ${r.ads.length} active Meta ads`
      )
    );
    const google = await optional(
      task(
        `competitor-${i}-google-ads`,
        async (track) => {
          const res = await readGoogleAds(c.website);
          track(res.usage);
          return res.ads;
        },
        (r) => `${c.name}: ${r.length} Google ads`
      )
    );
    const handle = givenInstagram(c) ?? meta?.instagram ?? null;
    const insta = handle
      ? await optional(
          task(
            `competitor-${i}-instagram`,
            async (track) => {
              const res = await readInstagram(handle);
              track(res.usage);
              return { followers: res.followers, posts: res.posts };
            },
            (r) => `${c.name}: read ${r.posts.length} top Instagram posts`
          )
        )
      : null;
    const homepage = await optional(
      task(
        `competitor-${i}-website`,
        async (track) => {
          const res = await readHomepage(c.website);
          track(res.usage);
          return res.text;
        },
        (r) => (r ? `${c.name}: read their homepage` : `${c.name}: no website to read`)
      )
    );

    const footprint: Footprint = {
      instagram: handle,
      followers: insta?.followers ?? null,
      posts: insta?.posts ?? [],
      metaAds: meta?.ads ?? [],
      googleAds: google ?? [],
      homepage: homepage ?? null,
    };
    const empty = !footprint.homepage && !footprint.posts.length && !footprint.metaAds.length && !footprint.googleAds.length;
    if (empty) return null;
    const summary = await optional(
      task(
        `competitor-${i}-summary`,
        async (track) => {
          const res = await summarizeCompetitor(db(), c, footprint, brief);
          track(res.usage);
          return res.analysis;
        },
        (r) => `${c.name}: ${r.angles.length} selling angles, ${r.gaps.length} gaps you could own`
      )
    );
    return summary ? { competitor: c, footprint } : null;
  });
  const studied = footprints.filter((f): f is { competitor: Competitor; footprint: Footprint } => !!f);

  // ---- Videos: own top and bottom, then competitors (uploaded first) ----
  const ownVideos: VideoToAnalyze[] = platforms.flatMap((p) => [
    ...p.top
      .filter((v) => v.videoUrl)
      .slice(0, 2)
      .map((v) => ({
        url: v.videoUrl!,
        platform: p.platform,
        source: "own_top" as const,
        label: p.label,
        score: v.score,
      })),
    ...p.bottom
      .filter((v) => v.videoUrl)
      .slice(0, 1)
      .map((v) => ({
        url: v.videoUrl!,
        platform: p.platform,
        source: "own_bottom" as const,
        label: p.label,
        score: v.score,
      })),
  ]);
  const competitorVideos: VideoToAnalyze[] = [
    ...ctx.referenceVideoKeys.map((key) => ({
      url: urlFor(env.NEXT_PUBLIC_SUPABASE_URL, key),
      platform: "upload",
      source: "competitor" as const,
      label: "a video you uploaded",
      score: null,
    })),
    ...studied.flatMap(({ competitor, footprint }) =>
      footprint.posts
        .filter((p) => p.videoUrl)
        .slice(0, 1)
        .map((p) => ({
          url: p.videoUrl!,
          platform: "instagram",
          source: "competitor" as const,
          label: competitor.name,
          score: null,
        }))
    ),
  ];
  const videos = [...ownVideos.slice(0, MAX_OWN_VIDEOS), ...competitorVideos.slice(0, MAX_COMPETITOR_VIDEOS)];

  const analyzed = (
    await inGroups(videos, PARALLEL, (video, i) =>
      optional(
        task(
          `video-${i}`,
          async (track) => {
            const res = await analyzeVideo(video);
            track(res.usage);
            return { ...video, analysis: res.analysis };
          },
          (r) =>
            `Watched a ${r.source === "competitor" ? `video from ${r.label}` : `${r.source === "own_top" ? "top" : "weak"} ${r.platform} video`}: ${r.analysis.hookType || "hook"}, ${r.analysis.pacing} pacing`
        )
      )
    )
  ).filter((v): v is AnalyzedVideo => !!v);

  // ---- Hooks ----
  const hookPosts: HookPost[] = [
    ...platforms.flatMap((p) =>
      p.top
        .filter((t) => t.caption)
        .map((t) => ({
          platform: p.platform,
          caption: t.caption!,
          source: "own_winner" as const,
          score: t.score,
        }))
    ),
    ...studied.flatMap(({ footprint }) =>
      footprint.posts
        .filter((p) => p.caption)
        .slice(0, 5)
        .map((p) => ({
          platform: "instagram",
          caption: p.caption!,
          source: "competitor" as const,
          score: null,
        }))
    ),
  ];
  const hooks =
    hookPosts.length || analyzed.length
      ? await optional(
          task(
            "save-hooks",
            async (track) => {
              const res = await saveHooks(db(), hookPosts, analyzed);
              track(res.usage);
              return res.saved;
            },
            (r) => `Added ${r} hooks to the hook library`
          )
        )
      : 0;

  const parts = [
    platforms.length ? `measured ${platforms.length} of your platforms` : "no posts of yours to measure yet",
    `studied ${studied.length} competitor${studied.length === 1 ? "" : "s"}`,
    analyzed.length && `watched ${analyzed.length} videos`,
    hooks && `saved ${hooks} hooks`,
  ].filter(Boolean);
  return `${parts.join(", ").replace(/^./, (c) => c.toUpperCase())}`;
});
