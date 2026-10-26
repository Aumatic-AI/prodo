import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingStatus } from "@/core/profile";

export interface SessionUser {
  id: string;
  email: string;
}

export interface SessionBusiness {
  id: string;
  name: string;
  logoKey: string | null;
  onboardingStatus: OnboardingStatus;
}

/** Where a login without a business is sent: signs it out and explains on the login page */
export const NO_BUSINESS_SIGN_OUT = "/api/auth/signout";

export interface Session {
  user: SessionUser;
  business: SessionBusiness;
}

/**
 * The logged-in user and their business summary. Cached for the whole request.
 * business is null only for a login that isn't linked to a business (the layouts sign it out).
 */
export const getSession = cache(async (): Promise<(Omit<Session, "business"> & { business: SessionBusiness | null }) | null> => {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  // RLS returns only this user's own business
  const { data: profile } = await db.from("business_profile").select("business_id, name, logo_key, onboarding_status").maybeSingle();

  return {
    user: { id: user.id, email: user.email ?? "" },
    business: profile
      ? { id: profile.business_id, name: profile.name ?? "", logoKey: profile.logo_key ?? null, onboardingStatus: profile.onboarding_status ?? "not_started" }
      : null,
  };
});
