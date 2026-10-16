import type { SupabaseClient } from "@supabase/supabase-js";

export interface Product {
  name: string;
  description?: string;
}

export interface BusinessProfile {
  id: number;
  name: string;
  logo_key: string | null;
  website: string | null;
  about: string;
  products: Product[];
}

export async function getProfile(db: SupabaseClient): Promise<BusinessProfile | null> {
  const { data } = await db
    .from("business_profile")
    .select("*")
    .eq("id", 1)
    .single();
  return data;
}

export async function saveProfile(
  db: SupabaseClient,
  fields: Partial<Omit<BusinessProfile, "id">>
): Promise<BusinessProfile> {
  const { data, error } = await db
    .from("business_profile")
    .upsert({ id: 1, ...fields }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}
