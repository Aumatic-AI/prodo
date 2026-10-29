import type { SupabaseClient } from "@supabase/supabase-js";
import type { Basics, BusinessProfile } from "./schemas";
import type { ContentPrefs } from "./load";
import { saveProgress } from "./sync";
import { getKit, saveKit } from "@/core/brand/kit";
import { assertOwnKey, businessIdOf } from "@/core/business";
import { removeFiles } from "@/providers/storage/remove-files";

const cityList = (cities: string) =>
  cities
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean);

/** Profile columns from the shared profile fields. */
function profileColumns(b: Omit<Basics, "colors" | "fonts" | "cta" | "ctaLinks" | "tone" | "avoidWords" | "disclaimers">) {
  return {
    name: b.name,
    logo_key: b.logoKey,
    description: b.description,
    website: b.website || null,
    // Only keep socials that were filled in
    social_urls: Object.fromEntries(Object.entries(b.socials).filter(([, url]) => url)),
    business_type: b.businessType,
    countries: b.countries,
    cities: cityList(b.cities),
    language: b.language,
    timezone: b.timezone,
    industry: b.industry,
    currency: b.currency,
  };
}

/** Checks a new logo is the business's own file and removes the old one after saving. */
async function withLogo(db: SupabaseClient, logoKey: string | null, save: () => Promise<void>) {
  const { data: profile } = await db.from("business_profile").select("logo_key").single();
  const businessId = await businessIdOf(db);
  if (logoKey) assertOwnKey(businessId, logoKey, [profile?.logo_key]);
  await save();
  // Old logo file is no longer used
  if (profile?.logo_key && profile.logo_key !== logoKey) await removeFiles(businessId, [profile.logo_key]);
}

/** Settings → Business profile: the profile and the goals. */
export async function saveProfile(db: SupabaseClient, b: BusinessProfile) {
  await withLogo(db, b.logoKey, async () => {
    const { data: profile } = await db.from("business_profile").select("cta_links, content_prefs").single();
    const prefs: ContentPrefs = { ...(profile?.content_prefs ?? {}), goals: b.goals };
    await saveProgress(db, "basics", {
      ...profileColumns(b),
      cta_links: { ...(profile?.cta_links ?? {}), website: b.website || undefined },
      content_prefs: prefs,
      primary_goal: b.goals[0],
    });
  });
}

/** Onboarding's Basics step: the profile, the brand look, where customers go, tone and rules. */
export async function saveBasics(db: SupabaseClient, b: Basics) {
  await withLogo(db, b.logoKey, async () => {
    const { data: profile } = await db.from("business_profile").select("cta_links").single();
    await saveProgress(db, "business", {
      ...profileColumns(b),
      primary_cta: b.cta,
      cta_links: {
        ...(profile?.cta_links ?? {}),
        website: b.website || undefined,
        shop: b.ctaLinks.shop || undefined,
        whatsapp: b.ctaLinks.whatsapp || undefined,
        booking: b.ctaLinks.book || undefined,
        phone: b.ctaLinks.call || undefined,
      },
      tone: b.tone,
      compliance: { avoid_words: b.avoidWords, forbidden_claims: [], disclaimers: b.disclaimers },
    });
  });

  // Colours and fonts: the client checked them here, so a change marks them as theirs
  const kit = await getKit(db);
  await saveKit(db, {
    colors: b.colors,
    fonts: b.fonts,
    photo_style: kit.photo_style,
    layout_style: kit.layout_style,
    template_ids: kit.template_ids,
  });
}
