import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { loadOnboarding } from "@/core/onboarding/load";

/** The wizard draft, loaded once per request and shared by the layout and pages. */
export const getOnboardingDraft = cache(async () => loadOnboarding(await createClient()));
