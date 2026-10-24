import { env } from "@/config/env";
import { PRICING } from "@/config/pricing";
import { notConfigured } from "@/core/errors";
import { request, statusError } from "@/providers/http";
import type { Result, Usage } from "@/providers/usage";
import type { AdCreative, AdvertiserMatch, ReadablePlatform, SocialPost, SocialProfile, WebResult } from "./types";

// Public social profiles, posts, ad libraries and Google search. 1 credit per call for the
// endpoints used here; the response says what it charged.

const SERVICE = "ScrapeCreators";
const API_BASE = "https://api.scrapecreators.com";

function usage(credits: number): Usage {
  return {
    provider: "scrapecreators",
    costUsd: credits * PRICING.scrapecreators.perCredit,
  };
}

/** GET with the key. Returns null for "not found" so a missing profile isn't an error. */
async function get(path: string, params: Record<string, string | undefined>): Promise<{ body: any | null; usage: Usage }> {
  if (!env.SCRAPECREATORS_API_KEY) throw notConfigured(SERVICE);
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => !!e[1]));
  const res = await request(SERVICE, `${API_BASE}${path}?${qs}`, {
    headers: { "x-api-key": env.SCRAPECREATORS_API_KEY },
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 404) return { body: null, usage: usage(Number(body?.credits_charged ?? 0)) };
  if (!res.ok || body?.success === false) {
    throw statusError(SERVICE, res.ok ? 502 : res.status, body?.message ?? body?.error);
  }
  return { body, usage: usage(Number(body?.credits_charged ?? 1)) };
}

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const isoFromSeconds = (s: unknown) => (typeof s === "number" ? new Date(s * 1000).toISOString() : undefined);

// ---------- Google ----------

export async function googleSearch(query: string, region?: string): Promise<Result<WebResult[]>> {
  const { body, usage } = await get("/v1/google/search", { query, region });
  const results = (body?.results ?? []).map((r: any) => ({
    url: r.url,
    title: r.title ?? "",
    description: r.description,
  }));
  return { data: results, usage };
}

/** Ads from Google's Ads Transparency Center for a website domain. */
export async function googleAds(domain: string): Promise<Result<AdCreative[]>> {
  const { body, usage } = await get("/v1/google/company/ads", { domain });
  const ads = (body?.ads ?? []).map((a: any): AdCreative => ({
    network: "google",
    id: a.creativeId,
    advertiser: a.advertiserName,
    format: a.format,
    firstShown: a.firstShown,
    lastShown: a.lastShown,
    url: a.adUrl,
  }));
  return { data: ads, usage };
}

// ---------- Meta Ad Library ----------

/** Facebook pages matching a business name, with their Instagram username when linked. */
export async function metaAdvertisers(query: string): Promise<Result<AdvertiserMatch[]>> {
  const { body, usage } = await get("/v1/facebook/adLibrary/search/companies", {
    query,
  });
  const matches = (body?.searchResults ?? []).map((r: any) => ({
    pageId: String(r.page_id),
    name: r.name ?? "",
    instagram: r.ig_username || undefined,
    likes: num(r.likes),
  }));
  return { data: matches, usage };
}

/** Active Meta (Facebook and Instagram) ads of a page. */
export async function metaAds(pageId: string, country?: string): Promise<Result<AdCreative[]>> {
  const { body, usage } = await get("/v1/facebook/adLibrary/company/ads", {
    pageId,
    country,
    status: "ACTIVE",
  });
  const ads = (body?.results ?? []).map((a: any): AdCreative => {
    const snap = a.snapshot ?? {};
    return {
      network: "meta",
      id: String(a.ad_archive_id),
      advertiser: a.page_name ?? snap.page_name,
      text: snap.body?.text ?? snap.cards?.[0]?.body,
      title: snap.title ?? snap.cards?.[0]?.title,
      cta: snap.cta_text,
      format: snap.display_format,
      firstShown: isoFromSeconds(a.start_date),
      lastShown: isoFromSeconds(a.end_date),
    };
  });
  return { data: ads, usage };
}

// ---------- Profiles ----------

export async function profile(platform: ReadablePlatform, handle: string): Promise<Result<SocialProfile | null>> {
  switch (platform) {
    case "instagram": {
      const { body, usage } = await get("/v1/instagram/profile", { handle });
      const u = body?.data?.user;
      if (!u) return { data: null, usage };
      return {
        data: {
          platform,
          handle,
          name: u.full_name,
          bio: u.biography,
          followers: num(u.edge_followed_by?.count),
          url: `https://www.instagram.com/${handle}/`,
        },
        usage,
      };
    }
    case "tiktok": {
      const { body, usage } = await get("/v1/tiktok/profile", { handle });
      if (!body?.user) return { data: null, usage };
      return {
        data: {
          platform,
          handle,
          name: body.user.nickname,
          bio: body.user.signature,
          followers: num(body.stats?.followerCount),
          url: `https://www.tiktok.com/@${handle}`,
        },
        usage,
      };
    }
    case "youtube": {
      const { body, usage } = await get("/v1/youtube/channel", { handle });
      if (!body?.channelId) return { data: null, usage };
      return {
        data: {
          platform,
          handle,
          name: body.name,
          bio: body.description,
          followers: num(body.subscriberCount),
          url: body.channel ?? `https://www.youtube.com/@${handle}`,
        },
        usage,
      };
    }
  }
}

// ---------- Posts ----------

function instagramPost(p: any): SocialPost {
  const type = p.media_type === 2 ? "video" : p.media_type === 8 ? "carousel" : "image";
  return {
    id: String(p.code ?? p.id),
    platform: "instagram",
    url: p.url ?? (p.code ? `https://www.instagram.com/p/${p.code}/` : undefined),
    caption: p.caption?.text,
    publishedAt: isoFromSeconds(p.taken_at),
    mediaType: type,
    videoUrl: p.video_versions?.[0]?.url,
    views: num(p.play_count ?? p.ig_play_count),
    likes: num(p.like_count),
    comments: num(p.comment_count),
    shares: null,
    saves: null,
  };
}

function tiktokPost(p: any, handle: string): SocialPost {
  const s = p.statistics ?? {};
  return {
    id: String(p.aweme_id),
    platform: "tiktok",
    url: `https://www.tiktok.com/@${handle}/video/${p.aweme_id}`,
    caption: p.desc,
    publishedAt: p.create_time_utc ?? isoFromSeconds(p.create_time),
    mediaType: "video",
    videoUrl: p.video?.play_addr?.url_list?.[0],
    views: num(s.play_count),
    likes: num(s.digg_count),
    comments: num(s.comment_count),
    shares: num(s.share_count),
    saves: num(s.collect_count),
  };
}

function youtubePost(v: any): SocialPost {
  return {
    id: String(v.id),
    platform: "youtube",
    url: v.url,
    caption: v.title,
    publishedAt: v.publishedTime,
    mediaType: "video",
    views: num(v.viewCountInt),
    likes: null,
    comments: null,
    shares: null,
    saves: null,
  };
}

/** Most recent public posts of a profile (one page, up to about 12–30 depending on the platform). */
export async function posts(platform: ReadablePlatform, handle: string, limit: number): Promise<Result<SocialPost[]>> {
  switch (platform) {
    case "instagram": {
      const { body, usage } = await get("/v2/instagram/user/posts", { handle });
      return {
        data: (body?.items ?? []).slice(0, limit).map(instagramPost),
        usage,
      };
    }
    case "tiktok": {
      const { body, usage } = await get("/v3/tiktok/profile/videos", {
        handle,
      });
      return {
        data: (body?.aweme_list ?? []).slice(0, limit).map((p: any) => tiktokPost(p, handle)),
        usage,
      };
    }
    case "youtube": {
      const { body, usage } = await get("/v1/youtube/channel-videos", {
        handle,
        sort: "latest",
      });
      return {
        data: (body?.videos ?? []).slice(0, limit).map(youtubePost),
        usage,
      };
    }
  }
}
