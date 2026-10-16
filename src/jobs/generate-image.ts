import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMedia, markReady, markFailed } from "@/core/media";
import { getProfile } from "@/core/profile";
import { buildImagePrompt } from "@/prompts/image";
import * as Kie from "@/providers/ai/kie";
import { storageKeyFor } from "@/providers/storage/supabase-storage";
import { NonRetriableError } from "inngest";

export const generateImage = inngest.createFunction(
  {
    id: "generate-image",
    retries: 3,
    concurrency: [{ limit: 5 }],
    cancelOn: [{ event: "media/deleted", match: "data.mediaId" }],
    onFailure: async ({ event }) => {
      const db = createAdminClient();
      const mediaId = event.data.event.data.mediaId;
      const msg = event.data.error?.message || "Image generation failed";
      await markFailed(db, mediaId, msg);
    },
  },
  { event: "media/generate-image" },
  async ({ event, step }) => {
    const db = createAdminClient();

    const media = await step.run("load-media", () => getMedia(db, event.data.mediaId));
    if (!media.idea) throw new NonRetriableError("No idea provided");

    const profile = await step.run("load-profile", () => getProfile(db));

    // 1. Build prompt with business context and send directly to Kie
    const prompt = buildImagePrompt(media.idea, profile, media.use_logo ?? false);
    const jobId = await step.run("trigger-kie", () =>
      Kie.createImageTask(prompt, (media.aspect_ratio as any) || "4:5")
    );

    // 2. Poll for completion (up to 24 attempts, ~3 min)
    let imageUrl: string | null = null;
    let attempts = 0;
    const MAX_ATTEMPTS = 24;

    while (!imageUrl && attempts < MAX_ATTEMPTS) {
      await step.sleep(`wait-${attempts}`, attempts === 0 ? "8s" : "6s");
      const status = await step.run(`poll-${attempts}`, () => Kie.checkTaskStatus(jobId));

      if (status.state === "success") {
        imageUrl = Kie.parseResultUrl(status.resultJson);
      } else if (status.state === "fail") {
        throw new Error(`Image generation failed: ${status.failMsg || status.failCode || "unknown"}`);
      }
      attempts++;
    }

    if (!imageUrl) throw new Error("Image generation timed out");
    const finalUrl = imageUrl;

    // 3. Download and upload to Supabase storage
    const storageKey = await step.run("store", async () => {
      const res = await fetch(finalUrl);
      if (!res.ok) throw new Error(`Download failed: ${res.status}`);
      const buffer = Buffer.from(await res.arrayBuffer());

      const key = storageKeyFor("image", media.id);
      const { error } = await db.storage
        .from("media")
        .upload(key, buffer, { contentType: "image/png" });
      if (error) throw new Error("Storage upload failed: " + error.message);
      return key;
    });

    // 4. Mark ready
    await step.run("finalize", () => markReady(db, media.id, storageKey));

    return { success: true, mediaId: media.id };
  }
);
