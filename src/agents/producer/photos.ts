import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief } from "@/core/creative/brief";
import type { PlanItem } from "@/core/plans/types";
import { publicUrl } from "@/providers/storage/paths";
import { loadContentRules, peoplePromptLine } from "@/core/content/prefs";
import type { PeopleChoice } from "@/core/onboarding/options";
import { pictureOnly } from "./picture-only";

// Real photos as reference images, so the real product, team or place appears in the ad.

/** The photo the brief picked, else the offering's first product photo, else none. */
export async function referencePhoto(db: SupabaseClient, brief: Brief, item: PlanItem): Promise<string | null> {
  const url = (key: string) => publicUrl(key);
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

/**
 * Up to `count` real photos: the one the brief picked, then this offering's photos, then the
 * brand's other photos (people only when the client allows them). For photo slideshows.
 */
export async function referencePhotos(db: SupabaseClient, brief: Brief, item: PlanItem, count: number): Promise<string[]> {
  const first = await referencePhoto(db, brief, item);
  if (count <= 1) return first ? [first] : [];
  const { people } = await loadContentRules(db);
  const kinds = ["product_photo", "general", "work", "location", ...(people === "none" ? [] : ["person", "team"])];
  const { data } = await db.from("brand_assets").select("storage_key, offering_id").in("kind", kinds).limit(60);
  const photos = (data ?? [])
    .filter((p) => !/\.(mp4|mov)$/i.test(p.storage_key))
    .sort((a, b) => Number(b.offering_id === item.offering_id) - Number(a.offering_id === item.offering_id))
    .map((p) => publicUrl(p.storage_key));
  return [...new Set([...(first ? [first] : []), ...photos])].slice(0, count);
}

/** How the brand's pictures look: its photo style, and whether people may appear. */
export interface PhotoSettings {
  style: string | null;
  people: PeopleChoice | null;
}

/** Image prompt with the brand's photo style, the people choice and the no-text rule. `fix` carries QA's notes on a redo. */
export function photoPrompt(prompt: string, settings: PhotoSettings, hasReference: boolean, fix?: string | null): string {
  return [
    pictureOnly(prompt).replace(/\s+$/, "").replace(/\.?$/, "."),
    settings.style ? `Photo style: ${settings.style}.` : "",
    peoplePromptLine(settings.people),
    hasReference ? "The product, person or place in the reference image must appear exactly as it looks: same shape, colours, materials and details." : "",
    "Professional advertising photography, realistic, high detail, clean composition with calm space for text added later.",
    "Absolutely no text, letters, numbers, logos, watermarks, signs, labels or captions anywhere in the image.",
    fix ? `Fix these problems from the last attempt: ${fix}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function photoSettings(db: SupabaseClient): Promise<PhotoSettings> {
  const [{ data }, rules] = await Promise.all([db.from("brand_kit").select("photo_style").single(), loadContentRules(db)]);
  return { style: data?.photo_style ?? null, people: rules.people };
}
