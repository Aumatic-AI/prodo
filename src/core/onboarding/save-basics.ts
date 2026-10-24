import type { SupabaseClient } from "@supabase/supabase-js";
import type { Basics } from "./schemas";
import { saveProgress } from "./sync";

export async function saveBasics(db: SupabaseClient, b: Basics) {
  const { data: profile } = await db.from("business_profile").select("cta_links, logo_key").eq("id", 1).single();

  // Only keep socials that were filled in
  const socials = Object.fromEntries(Object.entries(b.socials).filter(([, url]) => url));

  await saveProgress(
    db,
    "business",
    {
      name: b.name,
      logo_key: b.logoKey,
      description: b.description,
      website: b.website || null,
      social_urls: socials,
      business_type: b.businessType,
      countries: b.countries,
      language: b.language,
      timezone: b.timezone,
      primary_goal: b.primaryGoal,
      cta_links: { ...(profile?.cta_links ?? {}), website: b.website || undefined },
    },
    { cities: b.cities }
  );

  // Old logo file is no longer used
  if (profile?.logo_key && profile.logo_key !== b.logoKey) {
    await db.storage.from("media").remove([profile.logo_key]);
  }
}
