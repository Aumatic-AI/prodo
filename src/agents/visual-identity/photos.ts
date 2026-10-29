import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "@/config/env";
import { MODELS } from "@/config/models";
import { ai } from "@/providers/ai/registry";
import { urlFor } from "@/providers/storage/supabase-storage";
import { PHOTO_DESCRIPTIONS_SYSTEM, photoDescriptionsPrompt, photoDescriptionsSchema } from "@/prompts/agents/photo-descriptions";
import { optional } from "@/agents/run";
import { businessBrief, type ResearchContext } from "@/agents/research/context";
import type { AgentKit } from "@/agents/research/define";
import { inGroups } from "@/agents/research/define";

// One line about each of the client's photos (brand_assets.ai_description), so the Creative Director
// can pick the right real photo for a scene. Only photos without one are sent, so a refresh pays for new photos only.

const KINDS = ["product_photo", "person", "general", "team", "location", "work", "reference_image"];
const LABEL: Record<string, string> = {
  product_photo: "product photo",
  person: "a person who appears in posts",
  general: "the brand's own photo",
  team: "team photo",
  location: "place photo",
  work: "photo of their work",
  reference_image: "reference",
};
/** Photos per AI call, and in total per run */
const PER_CALL = 8;
const MAX_PHOTOS = 48;
const isVideo = (key: string) => /\.(mp4|mov)$/i.test(key);

type Photo = { id: string; kind: string; storage_key: string; tags: string[] | null; product: string | null };

export async function describePhotos({ db, ctx, task, step }: { db: () => SupabaseClient; ctx: ResearchContext; task: AgentKit["task"]; step: AgentKit["step"] }): Promise<number> {
  // Picked in a step: on a retry the list must stay the same, not shrink as descriptions get saved
  const photos = (await step.run("photos-to-describe", async () => {
    const { data, error } = await db()
      .from("brand_assets")
      .select("id, kind, storage_key, tags, offerings(name)")
      .in("kind", KINDS)
      .is("ai_description", null)
      .order("created_at")
      .limit(MAX_PHOTOS * 2);
    if (error) throw error;
    return (data ?? [])
      .filter((a) => !isVideo(a.storage_key))
      .slice(0, MAX_PHOTOS)
      .map((a) => ({ id: a.id, kind: a.kind, storage_key: a.storage_key, tags: a.tags, product: (a.offerings as unknown as { name: string } | null)?.name ?? null }));
  })) as Photo[];
  if (!photos.length) return 0;

  const groups = Array.from({ length: Math.ceil(photos.length / PER_CALL) }, (_, i) => photos.slice(i * PER_CALL, (i + 1) * PER_CALL));
  const done = await inGroups(groups, 3, (group, i) =>
    optional(
      task(
        `describe-photos-${i}`,
        async (track) => {
          const labels = group.map((a) => (a.product ? `${LABEL[a.kind]} of ${a.product}` : LABEL[a.kind]));
          const res = await ai.structured(photoDescriptionsSchema, photoDescriptionsPrompt(businessBrief(ctx), labels), {
            system: PHOTO_DESCRIPTIONS_SYSTEM,
            images: group.map((a) => urlFor(env.NEXT_PUBLIC_SUPABASE_URL, a.storage_key)),
            model: MODELS.vision,
          });
          track(res.usage);
          let saved = 0;
          for (const p of res.data.photos) {
            const asset = group[p.image - 1];
            if (!asset) continue;
            const tags = [...new Set([...(asset.tags ?? []), ...p.tags.map((t) => t.toLowerCase())])];
            const { error: saveError } = await db().from("brand_assets").update({ ai_description: p.description, tags }).eq("id", asset.id);
            if (saveError) throw saveError;
            saved++;
          }
          return saved;
        },
        (n) => `Described ${n} of your photos`
      )
    )
  );
  return done.reduce<number>((sum, n) => sum + (n ?? 0), 0);
}
