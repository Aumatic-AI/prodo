import type { SupabaseClient } from "@supabase/supabase-js";
import { currencyFor } from "@/config/currencies";
import { getKit } from "@/core/brand/kit";
import { LIMITS } from "@/config/limits";
import {
  POSTING_PLATFORMS,
  TONE_AXES,
  type ContentMix,
  type Goal,
  type ImageStyle,
  type LogoChoice,
  type PeopleChoice,
  type PostingPlatform,
  type ServiceArea,
  type VideoStyle,
} from "./options";
import { isStep } from "./steps";
import type { ScanState } from "./scan";
import type { OnboardingDraft, ProductDraft, ServiceDraft } from "./schemas";

/** Raw answers kept in business_profile.onboarding, for fields with no column of their own. */
export interface OnboardingRaw {
  step?: string;
  area?: ServiceArea | null;
  areas?: string;
  yearsInBusiness?: number | null;
  faqs?: string[];
  voiceName?: string | null;
  submittedAt?: string;
  runId?: string;
  research?: import("./research").ResearchState;
  scan?: ScanState;
}

/** business_profile.content_prefs: the "Your content" answers agents read whole. */
export interface ContentPrefs {
  goals?: Goal[];
  mix?: ContentMix;
  image_styles?: ImageStyle[];
  video_styles?: VideoStyle[];
  people?: PeopleChoice;
  logo?: LogoChoice;
}

const DEFAULT_POSTS: Partial<Record<PostingPlatform, number>> = { instagram: 3, facebook: 2 };
const CASE_TAG = "case:";
const REVIEW_KINDS = ["review", "testimonial"];
const isVideoKey = (key: string) => /\.(mp4|mov)$/i.test(key);

function byOffering<T extends { offering_id: string | null }>(rows: T[], offeringId: string) {
  return rows.filter((r) => r.offering_id === offeringId);
}

/** Found on the website and waiting for the client: shown in the wizard with a badge. */
const pending = (row: { source_id: string | null; verified: boolean }) => !!row.source_id && !row.verified;

/** Builds the full wizard draft from the database. One round of parallel queries. */
export async function loadOnboarding(db: SupabaseClient): Promise<OnboardingDraft> {
  const [profileRes, offeringsRes, offersRes, proofRes, assetsRes, datesRes, brandsRes, linksRes, kit] = await Promise.all([
    db.from("business_profile").select("*").single(),
    db.from("offerings").select("*").order("priority", { ascending: false }).order("created_at"),
    db.from("offers").select("*").order("created_at"),
    db.from("proof_items").select("*, brand_sources(url)").order("created_at"),
    db.from("brand_assets").select("*").order("created_at"),
    db.from("calendar_events").select("*").eq("source", "client").order("date"),
    db.from("competitors").select("*").eq("source", "client").order("created_at"),
    // Pasted links only (uploaded reference videos get a row without a link)
    db.from("brand_sources").select("id, url").eq("kind", "reference").not("url", "is", null).order("fetched_at"),
    getKit(db),
  ]);

  const firstError = [profileRes, offeringsRes, offersRes, proofRes, assetsRes, datesRes, brandsRes, linksRes].find((r) => r.error);
  if (firstError?.error) throw firstError.error;

  const p = profileRes.data;
  const raw: OnboardingRaw = p.onboarding ?? {};
  const prefs: ContentPrefs = p.content_prefs ?? {};
  const assets = assetsRes.data ?? [];
  const proof = proofRes.data ?? [];
  const productPhotos = assets.filter((a) => a.kind === "product_photo");
  const workPhotos = assets.filter((a) => a.kind === "work");
  const caseIdOf = (a: { tags: string[] | null }) => a.tags?.find((t) => t.startsWith(CASE_TAG))?.slice(CASE_TAG.length);
  const photo = (a: { id: string; storage_key: string }) => ({ id: a.id, key: a.storage_key });
  const media = (a: { id: string; storage_key: string; kind: string }) => ({ ...photo(a), video: a.kind === "reference_video" || isVideoKey(a.storage_key) });

  // Rows the client kept, and rows found on the website still waiting for them (sold-out ones stay out)
  const shown = (o: { active: boolean; source_id: string | null; verified: boolean; attributes: { in_stock?: boolean } | null }) =>
    o.active || (pending(o) && o.attributes?.in_stock !== false);
  const offerings = (offeringsRes.data ?? []).filter(shown);
  const countries: string[] = p.countries ?? [];
  const currency: string = p.currency ?? currencyFor(countries);

  const products: ProductDraft[] = offerings
    .filter((o) => o.kind === "product")
    .map((o) => ({
      id: o.id,
      name: o.name,
      price: o.price === null ? null : Number(o.price),
      currency: o.currency ?? currency,
      url: o.url ?? "",
      isHero: o.is_hero,
      photos: byOffering(productPhotos, o.id).slice(0, LIMITS.offeringPhotosMax).map(photo),
      benefits: o.benefits ?? [],
      audience: o.audience ?? "",
      objections: o.objections ?? [],
      ...(pending(o) ? { found: true } : {}),
    }));

  const services: ServiceDraft[] = offerings
    .filter((o) => o.kind === "service")
    .map((o) => ({
      id: o.id,
      name: o.name,
      priceModel: o.price_model ?? "fixed",
      price: o.price === null ? null : Number(o.price),
      currency: o.currency ?? currency,
      included: o.attributes?.included ?? o.description ?? "",
      url: o.url ?? "",
      turnaround: o.attributes?.turnaround ?? "",
      steps: o.attributes?.process ?? [],
      ...(pending(o) ? { found: true } : {}),
    }));

  const posting = (p.posting_prefs?.platforms ?? DEFAULT_POSTS) as Partial<Record<PostingPlatform, number>>;
  const links = p.cta_links ?? {};
  const step = raw.step && isStep(raw.step) ? raw.step : "website";

  return {
    step,
    status: p.onboarding_status,
    scan: raw.scan ?? null,
    content: {
      goals: prefs.goals ?? (p.primary_goal ? [p.primary_goal] : []),
      mix: prefs.mix ?? null,
      postsPerWeek: Object.fromEntries(POSTING_PLATFORMS.map((pl) => [pl, posting[pl] ?? 0])) as Record<PostingPlatform, number>,
      imageStyles: prefs.image_styles ?? [],
      videoStyles: prefs.video_styles ?? [],
      people: prefs.people ?? null,
      peoplePhotos: assets.filter((a) => a.kind === "person").map(photo),
      voiceId: p.voice_id,
      voiceName: raw.voiceName ?? null,
      musicMood: p.music_mood ?? "upbeat",
      logo: prefs.logo ?? "every",
      ownMedia: assets.filter((a) => a.kind === "general").map(media),
      references: assets.filter((a) => a.kind === "reference_image" || a.kind === "reference_video").map(media),
      referenceLinks: (linksRes.data ?? []).map((l) => l.url),
      brands: (brandsRes.data ?? []).map((c) => ({
        id: c.id,
        name: c.name,
        link: c.website ?? c.social_urls?.instagram ?? "",
        relation: c.relation ?? "competitor",
      })),
    },
    basics: {
      name: p.name ?? "",
      logoKey: p.logo_key,
      description: p.description ?? "",
      website: p.website ?? "",
      socials: p.social_urls ?? {},
      businessType: p.business_type,
      countries,
      cities: (p.cities ?? []).join(", "),
      language: p.language ?? "en",
      timezone: p.timezone ?? "",
      industry: p.industry ?? null,
      currency,
      colors: { primary: kit.colors.primary, secondary: kit.colors.secondary, accent: kit.colors.accent, bg: kit.colors.bg, text: kit.colors.text },
      fonts: { heading: kit.fonts.heading, body: kit.fonts.body },
      cta: p.primary_cta ?? null,
      ctaLinks: { shop: links.shop ?? "", whatsapp: links.whatsapp ?? "", book: links.booking ?? "", call: links.phone ?? "" },
      tone: Object.fromEntries(TONE_AXES.map((axis) => [axis, p.tone?.[axis] ?? 50])) as Record<(typeof TONE_AXES)[number], number>,
      avoidWords: p.compliance?.avoid_words ?? [],
      disclaimers: p.compliance?.disclaimers ?? [],
    },
    products: {
      products,
      offers: (offersRes.data ?? [])
        .filter((o) => o.active || pending(o))
        .map((o) => ({
          id: o.id,
          title: o.title,
          details: o.details ?? "",
          offeringId: o.offering_id,
          endsAt: o.ends_at ? o.ends_at.slice(0, 10) : "",
          ...(pending(o) ? { found: true } : {}),
        })),
      reviews: proof
        .filter((r) => REVIEW_KINDS.includes(r.kind) && (r.verified || pending(r)))
        .map((r) => ({
          id: r.id,
          content: r.content,
          author: r.author ?? "",
          offeringId: r.offering_id,
          sourceUrl: r.brand_sources?.url ?? "",
          ...(pending(r) ? { found: true } : {}),
        })),
      dates: (datesRes.data ?? []).map((d) => ({ id: d.id, name: d.name, date: d.date, kind: d.kind === "trend" ? "sale" : d.kind })),
    },
    services: {
      services,
      area: raw.area ?? null,
      areas: raw.areas ?? "",
      caseStudies: proof
        .filter((r) => r.kind === "case_study" && r.verified)
        .map((r) => ({
          id: r.id,
          client: r.author ?? "",
          result: r.content,
          photos: workPhotos.filter((a) => caseIdOf(a) === r.id).map(photo),
        })),
      yearsInBusiness: raw.yearsInBusiness ?? null,
      credentials: proof
        .filter((r) => (r.kind === "certification" || r.kind === "award") && r.verified)
        .map((r) => ({ id: r.id, kind: r.kind, content: r.content })),
      teamPhotos: assets
        .filter((a) => ["team", "location"].includes(a.kind) || (a.kind === "work" && !caseIdOf(a)))
        .map((a) => ({ id: a.id, key: a.storage_key, kind: a.kind })),
      leadMagnetUrl: links.lead_magnet ?? "",
      faqs: raw.faqs ?? [],
    },
  };
}

export { CASE_TAG };
