import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { OnboardingStatus } from "@/core/profile";

export interface SessionUser {
  id: string;
  email: string;
}

export interface SessionBusiness {
  name: string;
  logoKey: string | null;
  onboardingStatus: OnboardingStatus;
}

export interface Session {
  user: SessionUser;
  business: SessionBusiness;
}

/** The logged-in user and their business summary. Cached for the whole request. */
export const getSession = cache(async (): Promise<Session | null> => {
  const db = await createClient();
  const { data: { user } } = await db.auth.getUser();
  if (!user) return null;

  const { data: profile } = await db
    .from("business_profile")
    .select("name, logo_key, onboarding_status")
    .eq("id", 1)
    .single();

  return {
    user: { id: user.id, email: user.email ?? "" },
    business: {
      name: profile?.name ?? "",
      logoKey: profile?.logo_key ?? null,
      onboardingStatus: profile?.onboarding_status ?? "not_started",
    },
  };
});
