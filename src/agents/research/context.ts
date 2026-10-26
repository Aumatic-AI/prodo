import type { SupabaseClient } from "@supabase/supabase-js";
import { countryName } from "@/config/countries";
import type { OnboardingRaw } from "@/core/onboarding/load";

/** What the research agents know about the business before they start: the client's own answers. */
export interface ResearchContext {
  name: string;
  description: string;
  website: string | null;
  businessType: "product" | "service" | null;
  /** ISO codes, main market first */
  countries: string[];
  countryNames: string[];
  cities: string;
  language: string;
  socials: Record<string, string>;
  logoKey: string | null;
  offerings: { id: string; name: string; kind: string }[];
  competitors: {
    id: string;
    name: string;
    website: string | null;
    socialUrls: Record<string, string>;
    discovered: boolean;
  }[];
  /** Storage keys of photos the client uploaded */
  photoKeys: string[];
  /** Storage keys of competitor or reference videos the client uploaded */
  referenceVideoKeys: string[];
}

export async function loadResearchContext(db: SupabaseClient): Promise<ResearchContext> {
  const [profileRes, offeringsRes, competitorsRes, assetsRes] = await Promise.all([
    db.from("business_profile").select("*").single(),
    db.from("offerings").select("id, name, kind").eq("active", true).order("priority", { ascending: false }),
    db.from("competitors").select("id, name, website, social_urls, source").order("created_at"),
    db.from("brand_assets").select("kind, storage_key").order("created_at"),
  ]);
  const failed = [profileRes, offeringsRes, competitorsRes, assetsRes].find((r) => r.error);
  if (failed?.error) throw failed.error;

  const p = profileRes.data;
  const raw: OnboardingRaw = p.onboarding ?? {};
  const assets = assetsRes.data ?? [];
  const countries: string[] = p.countries ?? [];

  return {
    name: p.name ?? "",
    description: p.description ?? "",
    website: p.website || null,
    businessType: p.business_type,
    countries,
    countryNames: countries.map(countryName),
    cities: raw.cities ?? "",
    language: p.language ?? "en",
    socials: p.social_urls ?? {},
    logoKey: p.logo_key,
    offerings: offeringsRes.data ?? [],
    competitors: (competitorsRes.data ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      website: c.website,
      socialUrls: c.social_urls ?? {},
      discovered: c.source === "discovered",
    })),
    photoKeys: assets.filter((a) => ["product_photo", "team", "location", "work"].includes(a.kind)).map((a) => a.storage_key),
    referenceVideoKeys: assets.filter((a) => a.kind === "reference_video").map((a) => a.storage_key),
  };
}

/** One paragraph about the business for AI prompts. Only the client's own answers. */
export function businessBrief(ctx: ResearchContext): string {
  const place = [ctx.cities, ctx.countryNames.join(", ")].filter(Boolean).join(" · ");
  return [
    `Business: ${ctx.name}`,
    ctx.businessType && `Sells: ${ctx.businessType === "service" ? "services" : "products"}`,
    ctx.offerings.length && `Offerings: ${ctx.offerings.map((o) => o.name).join(", ")}`,
    place && `Market: ${place}`,
    ctx.website && `Website: ${ctx.website}`,
    ctx.description && `About: ${ctx.description}`,
  ]
    .filter(Boolean)
    .join("\n");
}
