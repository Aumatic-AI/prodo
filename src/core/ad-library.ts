import type { SupabaseClient } from "@supabase/supabase-js";
import { LIMITS } from "@/config/limits";
import { countryName, isCountryCode } from "@/config/countries";
import { AppError } from "@/core/errors";
import { ai, type LibraryAd } from "@/providers/ai/registry";

// The Ad library ("Copy a video" → Ad library): active Meta video ads whose words match a search, to copy.
// Every live call costs a credit, so each page is kept 48 hours (ad_library_searches) and read from there when
// it's asked for again; a business makes at most LIMITS.adLibraryCallsPerDay live calls a day, and each one is
// logged in agent_runs, so it shows on the Costs screen and counts toward the monthly budget.

export type { LibraryAd };

export interface LibraryQuery {
  /** A brand name or words in the ads */
  query: string;
  /** ISO 3166-1 code, or "ALL" */
  country: string;
  page: number;
}

export interface LibraryResult {
  ads: LibraryAd[];
  page: number;
  hasMore: boolean;
  /** Read from what was kept, so it cost nothing */
  cached: boolean;
  callsLeft: number;
}

export interface LibraryStart {
  /** The main market, the search's default country */
  country: string;
  callsLeft: number;
}

const keptSince = () => new Date(Date.now() - LIMITS.adLibraryCacheHours * 3600_000).toISOString();

function todayUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Live calls the business can still make today: every page fetched today is one. */
async function callsLeft(db: SupabaseClient): Promise<number> {
  const { count, error } = await db.from("ad_library_searches").select("id", { count: "exact", head: true }).gte("fetched_at", todayUtc());
  if (error) throw error;
  return Math.max(0, LIMITS.adLibraryCallsPerDay - (count ?? 0));
}

/** What the screen starts with: no vendor call. */
export async function libraryStart(db: SupabaseClient): Promise<LibraryStart> {
  const [profile, left] = await Promise.all([db.from("business_profile").select("countries").single(), callsLeft(db)]);
  if (profile.error) throw profile.error;
  const main = (profile.data?.countries as string[] | null)?.[0];
  return { country: main && isCountryCode(main) ? main : "ALL", callsLeft: left };
}

/** One page of results: kept for 48 hours, fetched (1 credit) only when it isn't. */
export async function libraryPage(db: SupabaseClient, businessId: string, ask: LibraryQuery): Promise<LibraryResult> {
  const asked = ask.query.trim().replace(/\s+/g, " ");
  if (asked.length < 2) throw new AppError("Type a brand name or a few words to search for.", "INVALID_INPUT", false);
  const country = ask.country === "ALL" || isCountryCode(ask.country) ? ask.country : "ALL";
  // kind stays "keyword": the table also allows "brand", for one advertiser's ads, which the screen doesn't offer
  const where = { kind: "keyword", query: asked.toLowerCase(), country };

  const { data: kept, error } = await db
    .from("ad_library_searches")
    .select("ads, next_cursor")
    .match({ ...where, page: ask.page })
    .gte("fetched_at", keptSince())
    .maybeSingle();
  if (error) throw error;
  if (kept) return { ads: kept.ads as LibraryAd[], page: ask.page, hasMore: !!kept.next_cursor, cached: true, callsLeft: await callsLeft(db) };

  // A later page starts where the one before it ended
  let cursor: string | undefined;
  if (ask.page > 1) {
    const { data: before, error: beforeError } = await db
      .from("ad_library_searches")
      .select("next_cursor")
      .match({ ...where, page: ask.page - 1 })
      .gte("fetched_at", keptSince())
      .maybeSingle();
    if (beforeError) throw beforeError;
    if (!before?.next_cursor) throw new AppError("This search is more than 2 days old. Search again to see more ads.", "INVALID_INPUT", false);
    cursor = before.next_cursor;
  }

  const left = await callsLeft(db);
  if (left <= 0) {
    throw new AppError(
      `You've used today's ${LIMITS.adLibraryCallsPerDay} Ad library searches. Searches you've already made still open, and new ones work again tomorrow.`,
      "RATE_LIMITED",
      false
    );
  }

  const res = await ai.ads.library.search(asked, country, cursor);

  // On the Costs screen and in the monthly budget, like every other paid call
  const place = country === "ALL" ? "every country" : countryName(country);
  const { error: logError } = await db.from("agent_runs").insert({
    agent: "ad_library",
    status: "done",
    summary: `Ad library: ads for "${asked}" in ${place}${ask.page > 1 ? `, page ${ask.page}` : ""} (${res.data.ads.length} video ads)`,
    cost_usd: Number(res.usage.costUsd.toFixed(4)),
  });
  // The paid-for page is still shown and kept; only its line on the Costs screen is missing
  if (logError) console.error("[ad-library] Couldn't log the call's cost:", logError.message);

  // Old pages go; a fresh first page also drops the later pages built on its old cursor
  const { error: oldError } = await db.from("ad_library_searches").delete().lt("fetched_at", keptSince());
  if (oldError) throw oldError;
  if (ask.page === 1) {
    const { error: laterError } = await db.from("ad_library_searches").delete().match(where).gt("page", 1);
    if (laterError) throw laterError;
  }
  const { error: saveError } = await db
    .from("ad_library_searches")
    .upsert(
      { business_id: businessId, ...where, page: ask.page, ads: res.data.ads, next_cursor: res.data.cursor, fetched_at: new Date().toISOString() },
      { onConflict: "business_id,kind,query,country,page" }
    );
  if (saveError) throw saveError;

  return { ads: res.data.ads, page: ask.page, hasMore: !!res.data.cursor, cached: false, callsLeft: left - 1 };
}

/** The ad id in a Meta Ad Library link (or a bare id), or null for any other link. */
export function adLibraryId(link: string): string | null {
  const url = link.trim();
  if (/^\d{6,}$/.test(url)) return url;
  if (!/facebook\.com\/ads\/library/i.test(url)) return null;
  return url.match(/[?&]id=(\d{6,})/)?.[1] ?? null;
}

/** An ad seen in the Ad library in the last 48 hours, so its video can be fetched without another call. */
export async function keptLibraryAd(db: SupabaseClient, adId: string): Promise<LibraryAd | null> {
  if (!/^\d+$/.test(adId)) return null;
  const { data, error } = await db
    .from("ad_library_searches")
    .select("ads")
    .filter("ads", "cs", JSON.stringify([{ id: adId }]))
    .gte("fetched_at", keptSince())
    .order("fetched_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return (data?.ads as LibraryAd[] | undefined)?.find((a) => a.id === adId) ?? null;
}
