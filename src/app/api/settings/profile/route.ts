import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { createClient } from "@/lib/supabase/server";
import { loadOnboarding } from "@/core/onboarding/load";
import { businessProfileSchema, type BusinessProfileDraft, type OnboardingDraft } from "@/core/onboarding/schemas";
import { saveProfile } from "@/core/onboarding/save-basics";
import { startPartialRefresh } from "@/core/onboarding/research";
import { inngest } from "@/jobs/client";
import type { SupabaseClient } from "@supabase/supabase-js";

/** The fields Settings edits: onboarding's profile fields and goals. */
function pick({ basics: b, content }: OnboardingDraft): BusinessProfileDraft {
  return {
    name: b.name,
    logoKey: b.logoKey,
    description: b.description,
    website: b.website,
    socials: b.socials,
    businessType: b.businessType,
    countries: b.countries,
    cities: b.cities,
    language: b.language,
    timezone: b.timezone,
    industry: b.industry,
    currency: b.currency,
    goals: content.goals,
  };
}

const load = async (db: SupabaseClient) => pick(await loadOnboarding(db));

// Business profile in Settings: the same fields, checks and save as onboarding
export const GET = apiHandler(async () => NextResponse.json(await load(await createClient())));

export const PUT = apiHandler(async (req: NextRequest) => {
  const { db, businessId } = await currentBusiness();
  const input = businessProfileSchema.parse(await req.json());
  const { data: before } = await db.from("business_profile").select("logo_key, onboarding_status").single();
  await saveProfile(db, input);

  // A new logo: the Visual Identity Analyst makes the light and dark versions again (and the colours,
  // unless the client set them by hand)
  if (input.logoKey && input.logoKey !== before?.logo_key && before?.onboarding_status === "done") {
    const research = await startPartialRefresh(db, ["visual_identity_analyst"]);
    if (research) {
      await inngest.send({ name: "onboarding/started", id: research.attempt, data: { businessId, runId: research.id, attempt: research.attempt, agents: ["visual_identity_analyst"] } });
    }
  }
  return NextResponse.json(await load(db));
});
