import { NonRetriableError } from "inngest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directBrief, directContext, directPrompt, type DirectImage } from "@/agents/creative-director/direct-context";
import { loadCreativeContext } from "@/agents/creative-director/context";
import { canvasesFor, kieRatio } from "@/agents/producer/canvases";
import { gpt2Resolution, imageEngine, openaiFallbackSize, openaiImage, openaiImageSize } from "@/config/image-ads";
import { ai } from "@/providers/ai/registry";
import { startJob, waitForJobs, type KieJob } from "@/agents/producer/kie";
import { keepPhoto, markMediaReady, saveFile, startMedia, syncCost } from "@/agents/producer/media";
import type { Step } from "@/agents/producer/types";
import { loadTheme } from "@/creative/theme";
import { getItem, updateItem } from "@/core/plans/plans";
import type { PlanItem } from "@/core/plans/types";
import { request } from "@/providers/http";
import { finalName, mediaKey, publicUrl, ratioName, workKey } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";
import { logUsage, taskFor } from "./task";

// Direct image ad (IMAGE_AD_MODE=direct): a test of "just give the image model everything".
// No Creative Director, no QA gates, no logo drawn by code. All the context the Creative Director
// would read goes to the image model as plain text, with the product photos and the logo attached,
// and its picture is the final ad (only resized to each platform's size).

/** Product photos sent with the request, besides the logo */
const MAX_PHOTOS = 4;

export async function produceDirect(
  step: Step,
  db: () => SupabaseClient,
  scope: { businessId: string; planId: string; itemId: string; oneOff: boolean },
  settle: (status: "ready") => Promise<unknown>
): Promise<{ status: "ready" }> {
  const { businessId, planId, itemId, oneOff } = scope;
  const cd = taskFor(step, "creative_director", { businessId, planId, itemId });

  // 1. Gather the context (no AI writes anything), make the post's brief by code, save it
  const prepared = await cd(
    "direct-context",
    async (track) => {
      const { ctx, usage } = await loadCreativeContext(db(), itemId);
      if (usage) track(usage);
      const theme = await loadTheme(db());
      const logo = theme.logo.onLight ?? theme.logo.onDark;
      // Only this product's own photos: another product's photo would pull it into the picture. A post about the brand (no
      // product) or a product with no photo of its own gets a couple of the brand's photos instead. ctx.assets has no videos,
      // and no people photos when the owner chose none.
      const own = ctx.offering ? ctx.assets.filter((a) => a.offeringId === ctx.offering!.id) : [];
      const photos = own.length ? own.slice(0, MAX_PHOTOS) : ctx.assets.slice(0, 2);
      const images: DirectImage[] = [
        ...photos.map((a) => ({
          url: publicUrl(a.storageKey),
          what: a.kind === "product_photo" && a.offeringName ? `real product photo of "${a.offeringName}"${a.description ? `: ${a.description}` : ""}` : `the business's own ${a.kind.replace("_", " ")} photo${a.description ? `: ${a.description}` : ""}`,
        })),
        ...(logo ? [{ url: logo, what: "the brand's logo" }] : []),
      ];
      const colours = { primary: theme.primary.bg, accent: theme.accent.bg, heading: theme.fonts.heading, body: theme.fonts.body };
      const brief = directBrief(ctx, photos[0]?.id ?? null);
      await updateItem(db(), itemId, { brief, captions: brief.captions, hook_type: brief.hook.type, hook_text: brief.hook.text, framework: brief.framework, levers: [], status: "briefed", error: null });
      return { prompt: directPrompt(directContext(ctx, colours, images)), refs: images.map((i) => i.url), brief, imageCount: images.length };
    },
    (r) => `Gathered the business context and ${r.imageCount} image${r.imageCount === 1 ? "" : "s"} for the image model (no brief written by AI)`
  );

  const item = (await step.run("load-item", () => getItem(db(), itemId))) as PlanItem;
  const mediaId = await step.run("start-media", async () => {
    const id = await startMedia(db(), item, prepared.brief, "4:5");
    await updateItem(db(), itemId, { selected_media_id: id });
    return id;
  });

  const producer = taskFor(step, "producer", { businessId, planId, itemId, mediaId });
  const canvases = canvasesFor("static", item.platforms);

  // 2. One request to the image model: the whole context and every image
  let photoUrl: string;
  if (imageEngine() === "openai") {
    // OpenAI's own image model answers with the picture itself
    photoUrl = await producer(
      "direct-openai",
      async (track) => {
        const res = await ai.imageFromReferences(prepared.prompt, prepared.refs, { ...openaiImage(), size: openaiImageSize(canvases[0].ratio), fallbackSize: openaiFallbackSize(canvases[0].ratio) });
        track(res.usage);
        const key = workKey(businessId, mediaId, "direct.png");
        await saveFile(db(), mediaId, "thumbnail", key, res.data, "image/png");
        return publicUrl(key);
      },
      () => "OpenAI's image model made the ad from the context and images"
    );
  } else {
    const started = await producer(
      "direct-start",
      async (track) => {
        if (imageEngine() === "kie-gpt2") {
          // GPT Image 2 on Kie. retried: true so a failure stands instead of silently switching to another model
          const ratio = canvases[0].ratio as "1:1" | "4:5" | "9:16" | "16:9";
          const made = await ai.imageGpt2(prepared.prompt, ratio, gpt2Resolution(ratio), prepared.refs);
          track(made.usage);
          return { key: "photo", kind: "image", taskId: made.data, url: null, prompt: prepared.prompt, aspect: ratio, refs: prepared.refs, retried: true } satisfies KieJob;
        }
        const res = await startJob({ key: "photo", kind: "image", prompt: prepared.prompt, aspect: kieRatio(canvases[0].ratio), refs: prepared.refs });
        track(res.usage);
        return res.job;
      },
      () => "Sent the context and images to the image model"
    );
    const done = await waitForJobs(step, "direct", [started], {
      first: "12s",
      every: "6s",
      max: 30,
      onRetry: (usage) => logUsage({ agent: "producer", businessId, planId, itemId, mediaId }, usage, "Made the ad again after a failed try"),
    });
    if (!done) throw new NonRetriableError("Making the ad took too long. Try again.");
    photoUrl = await producer("direct-keep", () => keepPhoto(db(), businessId, mediaId, done[0].url!, "direct"), () => "Saved the ad");
  }

  // 3. The model's picture is the final ad; only cropped to each platform's size
  await producer(
    "direct-sizes",
    async () => {
      const res = await request("File storage", photoUrl, {}, 30_000);
      if (!res.ok) throw new NonRetriableError("Couldn't read the saved ad. Try again.");
      const source = Buffer.from(await res.arrayBuffer());
      let mainKey = "";
      for (const [i, canvas] of canvases.entries()) {
        const png = await sharp(source).resize(canvas.width, canvas.height, { fit: "cover" }).png().toBuffer();
        const key = mediaKey(businessId, mediaId, finalName(ratioName(canvas.ratio), 0, "png"));
        if (i === 0) {
          await upload(key, png, "image/png");
          mainKey = key;
        } else await saveFile(db(), mediaId, "rendition", key, png, "image/png", { aspect_ratio: canvas.ratio });
      }
      await markMediaReady(db(), mediaId, mainKey);
      return mainKey;
    },
    () => `Fitted the ad to ${canvases.map((c) => c.ratio).join(", ")}`
  );

  await step.run("sync-cost", () => syncCost(db(), mediaId));
  await settle("ready");
  await step.sendEvent("settled", { name: "plan-item/settled", data: { businessId, itemId, planId, oneOff } });
  return { status: "ready" };
}
