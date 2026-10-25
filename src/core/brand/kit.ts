import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { BLACK, readablePairs, WHITE, type TextPair } from "@/lib/color";
import { TEMPLATE_IDS } from "@/core/creative/brief";

// The brand kit the Visual Identity Analyst builds and the client can override.

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Use a colour like #1A2B3C")
  .transform((v) => v.toLowerCase());

export const kitSchema = z.object({
  colors: z.object({ primary: hex.nullable(), secondary: hex.nullable(), accent: hex.nullable(), bg: hex, text: hex }),
  fonts: z.object({ heading: z.string().trim().max(80).nullable(), body: z.string().trim().max(80).nullable() }),
  photo_style: z.string().trim().max(1000).nullable(),
  layout_style: z.string().trim().max(1000).nullable(),
  /** Ad layouts this brand uses; empty = all of them */
  template_ids: z.array(z.enum(TEMPLATE_IDS)).max(TEMPLATE_IDS.length).default([]),
});
export type KitInput = z.infer<typeof kitSchema>;

export interface BrandKit extends KitInput {
  colors: KitInput["colors"] & { palette?: string[]; pairs: TextPair[] };
  /** Storage keys: full, light (for light backgrounds), dark (for dark backgrounds) */
  logo_variants: { full?: string; light?: string; dark?: string | null };
  updated_at: string;
}

export async function getKit(db: SupabaseClient): Promise<BrandKit> {
  const { data, error } = await db.from("brand_kit").select("*").eq("id", 1).single();
  if (error) throw error;
  return {
    colors: { primary: null, secondary: null, accent: null, bg: WHITE, text: BLACK, pairs: [], ...data.colors },
    fonts: { heading: null, body: null, ...data.fonts },
    logo_variants: data.logo_variants ?? {},
    photo_style: data.photo_style,
    layout_style: data.layout_style,
    template_ids: (data.template_ids ?? []).filter((t: string) => (TEMPLATE_IDS as readonly string[]).includes(t)),
    updated_at: data.updated_at,
  };
}

/** Saves the client's changes; readable text pairs are worked out again from the new colours. */
export async function saveKit(db: SupabaseClient, input: KitInput): Promise<BrandKit> {
  const current = await getKit(db);
  const c = input.colors;
  const pairs = readablePairs(
    [
      ["primary", c.primary],
      ["secondary", c.secondary],
      ["accent", c.accent],
      ["bg", c.bg],
      ["text", c.text],
    ],
    [WHITE, BLACK, c.text, c.bg]
  );
  // Colours or fonts the client changed are theirs: later research runs keep them
  const sameColors = (["primary", "secondary", "accent", "bg", "text"] as const).every((k) => current.colors[k] === c[k]);
  const sameFonts = current.fonts.heading === input.fonts.heading && current.fonts.body === input.fonts.body;
  const { error } = await db
    .from("brand_kit")
    .update({
      colors: { ...current.colors, ...c, pairs, ...(sameColors ? {} : { manual: true }) },
      fonts: { ...current.fonts, ...input.fonts, ...(sameFonts ? {} : { manual: true }) },
      photo_style: input.photo_style,
      layout_style: input.layout_style,
      template_ids: input.template_ids,
    })
    .eq("id", 1);
  if (error) throw error;
  return getKit(db);
}
