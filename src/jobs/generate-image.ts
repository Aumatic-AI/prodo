import { inngest } from "./client";
import { adoptFinishedMedia } from "@/core/plans/plans";
import { toInngestError } from "./to-inngest-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMedia, markReady, markFailed, productNameFor, type Media } from "@/core/media";
import { getProfile } from "@/core/profile";
import { AppError } from "@/core/errors";
import { LIMITS } from "@/config/limits";
import { buildImagePrompt } from "@/prompts/image";
import { composeCreativeImage } from "@/providers/creative-render/composeCreativeImage";
import { ai, type KieAspectRatio } from "@/providers/ai/registry";
import { request } from "@/providers/http";
import { storageKeyFor, upload, urlFor } from "@/providers/storage/supabase-storage";
import { NonRetriableError } from "inngest";

const MAX_POLLS = 24; // ~3 min

export const generateImage = inngest.createFunction(
  {
    id: "generate-image",
    retries: 3,
    concurrency: [{ limit: 5 }],
    cancelOn: [{ event: "media/deleted", match: "data.mediaId" }],
    onFailure: async ({ event }) => {
      const db = createAdminClient();
      const msg = event.data.error?.message || "Image generation failed";
      await markFailed(db, event.data.event.data.mediaId, msg);
    },
  },
  { event: "media/generate-image" },
  async ({ event, step }) => {
    const db = createAdminClient();

    const media = await step.run("load-media", () => getMedia(db, event.data.mediaId));
    if (!media.idea) throw new NonRetriableError("No idea provided");

    const profile = await step.run("load-profile", () => getProfile(db));
    const productName = await step.run("load-product", () => productNameFor(db, media as Media));

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const referenceUrl = media.reference_image_key ? urlFor(supabaseUrl, media.reference_image_key) : undefined;
    const logoUrl = media.use_logo && profile?.logo_key ? urlFor(supabaseUrl, profile.logo_key) : undefined;
    const aspectRatio = (media.aspect_ratio as "1:1" | "4:5" | "9:16" | "16:9") || "4:5";
    // nano-banana-2 has no 4:5, so ask for the closest portrait ratio
    const kieAspectRatio: KieAspectRatio = aspectRatio === "4:5" ? "2:3" : aspectRatio;

    const prompt = buildImagePrompt(media.idea, profile, !!referenceUrl, productName || undefined);
    const taskId = await step.run("create-task", () =>
      ai.image.create(prompt, kieAspectRatio, referenceUrl ? [referenceUrl] : []).then((r) => r.data).catch(toInngestError)
    );

    let imageUrl: string | null = null;
    for (let i = 0; i < MAX_POLLS && !imageUrl; i++) {
      await step.sleep(`wait-${i}`, i === 0 ? "8s" : "6s");
      imageUrl = await step.run(`poll-${i}`, async () => {
        try {
          const status = await ai.image.status(taskId);
          if (status.state === "fail") throw ai.task.error(status, "image");
          return status.state === "success" ? ai.task.resultUrl(status) : null;
        } catch (err) {
          return toInngestError(err);
        }
      });
    }
    if (!imageUrl) throw new NonRetriableError("This took too long. Try again.");
    const finalUrl = imageUrl;

    // Our code draws the logo onto the photo, then the file goes to our storage
    const storageKey = await step.run("store", async () => {
      try {
        const buffer =
          (logoUrl && (await composeCreativeImage({ photoUrl: finalUrl, logoUrl, aspectRatio }))) ||
          (await download(finalUrl));
        const key = storageKeyFor("image", media.id);
        await upload(db, key, buffer, "image/png");
        return key;
      } catch (err) {
        return toInngestError(err);
      }
    });

    await step.run("finalize", async () => {
      await markReady(db, media.id, storageKey);
      // A planned post's media made here: the post picks it up (as needing a look)
      await adoptFinishedMedia(db, media.id);
    });
    return { success: true, mediaId: media.id };
  }
);

async function download(url: string): Promise<Buffer> {
  const res = await request("Kie.ai", url, {}, LIMITS.downloadTimeoutMs);
  if (!res.ok) throw new AppError("Couldn't download the finished image. Try again.", "PROVIDER_DOWN", true);
  return Buffer.from(await res.arrayBuffer());
}
