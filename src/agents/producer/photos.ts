import type { SupabaseClient } from "@supabase/supabase-js";
import type { Brief } from "@/core/creative/brief";
import type { PlanItem } from "@/core/plans/types";
import { publicUrl } from "@/providers/storage/paths";
import { loadContentRules, peoplePromptLine } from "@/core/content/prefs";
import type { PeopleChoice } from "@/core/onboarding/options";
import { photoWords, pictureOnly } from "./picture-only";

// Real photos as reference images, so the real product, team or place appears in the ad.

/**
 * What a reference photo is for. A product photo gives the image model the product only (the model
 * in it is someone's real person, and the accessories aren't for sale); only the client's own
 * person and team photos keep their real person, and a location photo its real place.
 */
export type ReferenceUse = "product" | "person" | "place";
export const referenceUse = (kind: string): ReferenceUse => (kind === "person" || kind === "team" ? "person" : kind === "location" ? "place" : "product");

export interface Reference {
  url: string;
  use: ReferenceUse;
}

/** The photo the brief picked, else the offering's first product photo, else none. */
export async function referencePhoto(db: SupabaseClient, brief: Brief, item: PlanItem): Promise<Reference | null> {
  if (brief.referenceAssetId) {
    const { data } = await db.from("brand_assets").select("storage_key, kind").eq("id", brief.referenceAssetId).maybeSingle();
    if (data?.storage_key) return { url: publicUrl(data.storage_key), use: referenceUse(data.kind) };
  }
  if (item.offering_id) {
    const { data } = await db.from("brand_assets").select("storage_key").eq("offering_id", item.offering_id).eq("kind", "product_photo").limit(1);
    if (data?.[0]?.storage_key) return { url: publicUrl(data[0].storage_key), use: "product" };
  }
  return null;
}

/**
 * Up to `count` real photos: the one the brief picked, then this offering's photos, then the
 * brand's other photos (people only when the client allows them). For photo slideshows.
 */
export async function referencePhotos(db: SupabaseClient, brief: Brief, item: PlanItem, count: number): Promise<string[]> {
  const first = (await referencePhoto(db, brief, item))?.url ?? null;
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

/** Image prompt with the brand's photo style, the people choice and the no-text rule. `fix` carries QA's notes on a redo. Video scenes use this one. */
export function photoPrompt(prompt: string, settings: PhotoSettings, hasReference: boolean, fix?: string | null): string {
  return [
    pictureOnly(prompt).replace(/\s+$/, "").replace(/\.?$/, "."),
    settings.style ? `Photo style: ${settings.style}.` : "",
    peoplePromptLine(settings.people),
    hasReference ? "The product, person or place in the reference image must appear exactly as it looks: same shape, colours, materials and details." : "",
    "Professional advertising photography that looks like a real photo: a single natural light source, real materials, natural skin texture, clean composition with calm space for text added later.",
    "Absolutely no text, letters, numbers, logos, watermarks, signs, labels or captions anywhere in the image.",
    fix ? `Fix these problems from the last attempt: ${fix}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export const REFERENCE_LINE: Record<ReferenceUse, string> = {
  product:
    "The reference image shows the real product: reproduce the product exactly (shape, colours, fabric, pattern, embroidery and details). Use it for the product only: any person in the picture is a different person from the one in the reference (a different face and hair), and the reference's headwear, jewellery, accessories, props and background are left out.",
  person: "The reference image shows the business's real person: keep their face and look exactly.",
  place: "The reference image shows the business's real place: keep it exactly as it looks.",
};

/**
 * The photo prompt for image ads and carousel covers: like photoPrompt, plus what the reference is
 * for (a product photo gives the product, never its model or accessories) and how the ad's layout
 * needs the photo framed. Our labels and colour codes become words first.
 */
export function adPhotoPrompt(prompt: string, settings: PhotoSettings, reference: ReferenceUse | null, fix: string | null | undefined, framing: string): string {
  return [
    pictureOnly(photoWords(prompt)).replace(/\s+$/, "").replace(/\.?$/, "."),
    settings.style ? `Photo style: ${settings.style}.` : "",
    peoplePromptLine(settings.people),
    reference ? REFERENCE_LINE[reference] : "",
    framing,
    "Professional advertising photography that looks like a real photo: a single natural light source, real materials, natural skin texture.",
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
