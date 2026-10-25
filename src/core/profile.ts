import type { SupabaseClient } from "@supabase/supabase-js";

export type BusinessType = "product" | "service";
export type PrimaryGoal = "awareness" | "leads" | "sales" | "bookings" | "followers";
export type OnboardingStatus = "not_started" | "collecting" | "analyzing" | "review" | "done";

export interface Compliance {
  avoid_words: string[];
  forbidden_claims: string[];
  disclaimers: string[];
}

export interface BusinessProfile {
  id: number;
  name: string;
  logo_key: string | null;
  website: string | null;
  description: string;
  business_type: BusinessType | null;
  language: string;
  timezone: string | null;
  countries: string[];
  primary_goal: PrimaryGoal | null;
  social_urls: Record<string, string>;
  cta_links: Record<string, string>;
  /** Sliders 0–100: formal, playful, bold, technical */
  tone: Record<string, number>;
  liked_brands: string[];
  compliance: Compliance;
  /** {platforms: {instagram: 4, …}, formats: […]} */
  posting_prefs: Record<string, unknown>;
  voice_id: string | null;
  music_mood: string | null;
  onboarding: Record<string, unknown>;
  onboarding_status: OnboardingStatus;
  updated_at: string;
}

export async function getProfile(db: SupabaseClient): Promise<BusinessProfile | null> {
  const { data } = await db
    .from("business_profile")
    .select("*")
    .eq("id", 1)
    .single();
  return data;
}

