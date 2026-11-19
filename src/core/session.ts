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
  /** The business's own login email (its owner's); differs from the user's after switching to another business */
  loginEmail: string | null;
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

  // RLS returns only the business this request is for (the one picked on this device, or the login's own)
  const [{ data: profile, error }, owner] = await Promise.all([
    db.from("business_profile").select("business_id, name, logo_key, onboarding_status").maybeSingle(),
    db.rpc("business_login_email"),
  ]);
  // A failed read is an error, never "no business" (that would sign the user out)
  if (error) throw error;

  return {
    user: { id: user.id, email: user.email ?? "" },
    business: profile
      ? {
          id: profile.business_id,
          name: profile.name ?? "",
          logoKey: profile.logo_key ?? null,
          onboardingStatus: profile.onboarding_status ?? "not_started",
          // Only for display: when it can't be read, the menu shows the user's own email
          loginEmail: owner.error ? null : ((owner.data as string | null) ?? null),
        }
      : null,
  };
});
