import type { SupabaseClient } from "@supabase/supabase-js";
import { POSTING_PLATFORMS, TONE_AXES, type PostingPlatform, type ServiceArea } from "./options";
import { isStep } from "./steps";
import type { OnboardingDraft, ProductDraft, ServiceDraft } from "./schemas";

/** Raw answers kept in business_profile.onboarding, for fields with no column of their own. */
export interface OnboardingRaw {
  step?: string;
  cities?: string;
  area?: ServiceArea | null;
  areas?: string;
  yearsInBusiness?: number | null;
  faqs?: string[];
  voiceName?: string | null;
  submittedAt?: string;
  runId?: string;
  research?: import("./research").ResearchState;
}

const DEFAULT_POSTS: Partial<Record<PostingPlatform, number>> = { instagram: 3, facebook: 2 };
const CASE_TAG = "case:";

function byOffering<T extends { offering_id: string | null }>(rows: T[], offeringId: string) {
  return rows.filter((r) => r.offering_id === offeringId);
}

/** Builds the full wizard draft from the database. One round of parallel queries. */
export async function loadOnboarding(db: SupabaseClient): Promise<OnboardingDraft> {
  const [profileRes, settingsRes, offeringsRes, offersRes, proofRes, assetsRes, datesRes, competitorsRes] = await Promise.all([
    db.from("business_profile").select("*").single(),
    db.from("app_settings").select("*").single(),
    db.from("offerings").select("*").eq("active", true).order("priority", { ascending: false }).order("created_at"),
    db.from("offers").select("*").eq("active", true).order("created_at"),
    // Only confirmed proof: facts the agents found wait for the client in the Brand Bible review
    db.from("proof_items").select("*, brand_sources(url)").eq("verified", true).order("created_at"),
    db.from("brand_assets").select("*").order("created_at"),
    db.from("calendar_events").select("*").eq("source", "client").order("date"),
    db.from("competitors").select("*").eq("source", "client").order("created_at"),
  ]);

  const firstError = [profileRes, settingsRes, offeringsRes, offersRes, proofRes, assetsRes, datesRes, competitorsRes].find((r) => r.error);
  if (firstError?.error) throw firstError.error;

  const p = profileRes.data;
  const s = settingsRes.data;
  const raw: OnboardingRaw = p.onboarding ?? {};
  const offerings = offeringsRes.data ?? [];
  const proof = proofRes.data ?? [];
  const assets = assetsRes.data ?? [];

  const photo = (a: { id: string; storage_key: string }) => ({ id: a.id, key: a.storage_key });
  const productPhotos = assets.filter((a) => a.kind === "product_photo");

  const products: ProductDraft[] = offerings
    .filter((o) => o.kind === "product")
    .map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price === null ? null : Number(o.price),
      currency: o.currency ?? "USD",
      url: o.url ?? "",
      isHero: o.is_hero,
      photos: byOffering(productPhotos, o.id).map(photo),
      benefits: o.benefits ?? [],
      audience: o.audience ?? "",
      objections: o.objections ?? [],
    }));

  const services: ServiceDraft[] = offerings
    .filter((o) => o.kind === "service")
    .map((o) => ({
      id: o.id,
      name: o.name,
      priceModel: o.price_model ?? "fixed",
      price: o.price === null ? null : Number(o.price),
      currency: o.currency ?? "USD",
      included: o.attributes?.included ?? "",
      url: o.url ?? "",
      turnaround: o.attributes?.turnaround ?? "",
      steps: o.attributes?.process ?? [],
    }));

  const workPhotos = assets.filter((a) => a.kind === "work");
  const caseIdOf = (a: { tags: string[] }) => a.tags?.find((t) => t.startsWith(CASE_TAG))?.slice(CASE_TAG.length);

  const posting = (p.posting_prefs?.platforms ?? DEFAULT_POSTS) as Partial<Record<PostingPlatform, number>>;

  return {
    step: raw.step && isStep(raw.step) ? raw.step : "basics",
    status: p.onboarding_status,
    basics: {
      name: p.name ?? "",
      logoKey: p.logo_key,
      description: p.description ?? "",
      website: p.website ?? "",
      socials: p.social_urls ?? {},
      businessType: p.business_type,
      countries: p.countries ?? [],
      cities: raw.cities ?? "",
      language: p.language ?? "en",
      timezone: p.timezone ?? "",
      primaryGoal: p.primary_goal,
    },
    products: {
      products,
      offers: (offersRes.data ?? []).map((o) => ({
        id: o.id,
        title: o.title,
        details: o.details ?? "",
        offeringId: o.offering_id,
        endsAt: o.ends_at ? o.ends_at.slice(0, 10) : "",
      })),
      reviews: proof
        .filter((r) => r.kind === "review" || r.kind === "testimonial")
        .map((r) => ({
          id: r.id,
          content: r.content,
          author: r.author ?? "",
          offeringId: r.offering_id,
          sourceUrl: r.brand_sources?.url ?? "",
        })),
      dates: (datesRes.data ?? []).map((d) => ({ id: d.id, name: d.name, date: d.date, kind: d.kind === "trend" ? "sale" : d.kind })),
    },
    services: {
      services,
      area: raw.area ?? null,
      areas: raw.areas ?? "",
      caseStudies: proof
        .filter((r) => r.kind === "case_study")
        .map((r) => ({
          id: r.id,
          client: r.author ?? "",
          result: r.content,
          photos: workPhotos.filter((a) => caseIdOf(a) === r.id).map(photo),
        })),
      yearsInBusiness: raw.yearsInBusiness ?? null,
      credentials: proof
        .filter((r) => r.kind === "certification" || r.kind === "award")
        .map((r) => ({ id: r.id, kind: r.kind, content: r.content })),
      teamPhotos: assets
        .filter((a) => ["team", "location"].includes(a.kind) || (a.kind === "work" && !caseIdOf(a)))
        .map((a) => ({ id: a.id, key: a.storage_key, kind: a.kind })),
      bookingUrl: p.cta_links?.booking ?? "",
      whatsapp: p.cta_links?.whatsapp ?? "",
      leadMagnetUrl: p.cta_links?.lead_magnet ?? "",
      faqs: raw.faqs ?? [],
    },
    style: {
      tone: Object.fromEntries(TONE_AXES.map((axis) => [axis, p.tone?.[axis] ?? 50])) as Record<(typeof TONE_AXES)[number], number>,
      likedBrands: p.liked_brands ?? [],
      competitors: (competitorsRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        link: c.website ?? c.social_urls?.instagram ?? "",
      })),
      competitorVideos: assets.filter((a) => a.kind === "reference_video").map(photo),
      avoidWords: p.compliance?.avoid_words ?? [],
      disclaimers: p.compliance?.disclaimers ?? [],
      postsPerWeek: Object.fromEntries(POSTING_PLATFORMS.map((pl) => [pl, posting[pl] ?? 0])) as Record<PostingPlatform, number>,
      voiceId: p.voice_id,
      voiceName: raw.voiceName ?? null,
      musicMood: p.music_mood ?? "upbeat",
      autopilotMode: s.autopilot_mode,
      planWeekday: s.plan_weekday,
      planTime: String(s.plan_time).slice(0, 5),
      monthlyBudgetUsd: Number(s.monthly_budget_usd),
    },
  };
}

export { CASE_TAG };
