import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { loadOnboarding } from "./load";
import { newResearch, type ResearchState } from "./research";
import { STEP_SCHEMAS } from "./schemas";
import type { StepKey } from "./steps";

/** First step whose saved answers are incomplete, or null when everything is ready. */
export async function firstIncompleteStep(db: SupabaseClient): Promise<StepKey | null> {
  const draft = await loadOnboarding(db);
  if (!STEP_SCHEMAS.basics.safeParse(draft.basics).success) return "basics";
  const business = draft.basics.businessType === "service" ? STEP_SCHEMAS.services.safeParse(draft.services) : STEP_SCHEMAS.products.safeParse(draft.products);
  if (!business.success) return "business";
  if (!STEP_SCHEMAS.style.safeParse(draft.style).success) return "style";
  return null;
}

/** Marks onboarding as submitted and sets up the research run. A second submit returns the same run. */
export async function submitOnboarding(db: SupabaseClient): Promise<{ research: ResearchState; started: boolean }> {
  const missing = await firstIncompleteStep(db);
  if (missing) {
    throw new AppError("Some steps are not finished yet. Check them and submit again.", "INVALID_INPUT", false);
  }

  const { data: profile, error: readError } = await db.from("business_profile").select("onboarding, onboarding_status").eq("id", 1).single();
  if (readError) throw readError;
  const existing: ResearchState | undefined = profile.onboarding?.research;
  if (profile.onboarding_status !== "collecting" && profile.onboarding_status !== "not_started" && existing) {
    return { research: existing, started: false };
  }

  const research = newResearch();
  const { error } = await db
    .from("business_profile")
    .update({
      onboarding_status: "analyzing",
      onboarding: { ...(profile.onboarding ?? {}), runId: research.id, submittedAt: new Date().toISOString(), research },
    })
    .eq("id", 1);
  if (error) throw error;
  return { research, started: true };
}
