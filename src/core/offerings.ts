import type { SupabaseClient } from "@supabase/supabase-js";

export type OfferingKind = "product" | "service";
export type PriceModel = "fixed" | "from" | "hourly" | "quote" | "subscription";

export interface Offering {
  id: string;
  kind: OfferingKind;
  name: string;
  description: string | null;
  url: string | null;
  price: number | null;
  currency: string | null;
  price_model: PriceModel | null;
  benefits: string[];
  objections: string[];
  audience: string | null;
  is_hero: boolean;
  priority: number;
  attributes: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export async function listOfferings(db: SupabaseClient, opts: { includeArchived?: boolean } = {}) {
  let query = db
    .from("offerings")
    .select("*")
    .order("is_hero", { ascending: false })
    .order("priority", { ascending: false })
    .order("created_at", { ascending: true });
  if (!opts.includeArchived) query = query.eq("active", true);
  const { data, error } = await query;
  if (error) throw error;
  return data as Offering[];
}

export async function getOffering(db: SupabaseClient, id: string) {
  const { data, error } = await db.from("offerings").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Offering | null;
}
