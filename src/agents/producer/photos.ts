import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief } from "@/core/creative/brief";
import type { PlanItem } from "@/core/plans/types";
import { urlFor } from "@/providers/storage/supabase-storage";

// Real photos as reference images, so the real product, team or place appears in the ad.

/** The photo the brief picked, else the offering's first product photo, else none. */
export async function referencePhoto(db: SupabaseClient, brief: Brief, item: PlanItem): Promise<string | null> {
  const url = (key: string) => urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
  if (brief.referenceAssetId) {
    const { data } = await db.from("brand_assets").select("storage_key").eq("id", brief.referenceAssetId).maybeSingle();
    if (data?.storage_key) return url(data.storage_key);
  }
  if (item.offering_id) {
    const { data } = await db.from("brand_assets").select("storage_key").eq("offering_id", item.offering_id).eq("kind", "product_photo").limit(1);
    if (data?.[0]?.storage_key) return url(data[0].storage_key);
  }
  return null;
}

/** Image prompt with the brand's photo style and the no-text rule. `fix` carries QA's notes on a redo. */
export function photoPrompt(prompt: string, photoStyle: string | null, hasReference: boolean, fix?: string | null): string {
  return [
    prompt.replace(/\s+$/, "").replace(/\.?$/, "."),
    photoStyle ? `Photo style: ${photoStyle}.` : "",
    hasReference ? "The product, person or place in the reference image must appear exactly as it looks: same shape, colours, materials and details." : "",
    "Professional advertising photography, realistic, high detail, clean composition with calm space for text added later.",
    "Absolutely no text, letters, numbers, logos, watermarks, signs, labels or captions anywhere in the image.",
    fix ? `Fix these problems from the last attempt: ${fix}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function photoStyle(db: SupabaseClient): Promise<string | null> {
  const { data } = await db.from("brand_kit").select("photo_style").eq("id", 1).single();
  return data?.photo_style ?? null;
}
