import { NonRetriableError } from "inngest";
import { contrast } from "@/lib/color";
import type { StaticBrief } from "@/core/creative/brief";
import { renderPng } from "@/creative/render";
import { AD_TEMPLATES } from "@/creative/templates/ads";
import { loadTheme, themePairs } from "@/creative/theme";
import { upload, urlFor } from "@/providers/storage/supabase-storage";
import { logUsage } from "@/agents/weekly/task";
import { canvasesFor, kieRatio } from "./canvases";
import { startJob, waitForJobs } from "./kie";
import { dated, keepPhoto, markMediaReady, saveFile } from "./media";
import { photoPrompt, photoStyle, referencePhoto } from "./photos";
import type { ProduceArgs, Produced } from "./types";

// Static ad: one AI photo (with the real product as reference) → our layout draws headline,
// subhead, badge, CTA and logo in brand colours → one file per platform size.

export async function produceStatic(a: ProduceArgs, brief: StaticBrief): Promise<Produced> {
  const canvases = canvasesFor("static", a.item.platforms);

  const started = await a.task(
    `photo-start-${a.round}`,
    async (track) => {
      const reference = await referencePhoto(a.db(), brief, a.item);
      const prompt = photoPrompt(brief.imagePrompt, await photoStyle(a.db()), !!reference, a.fix);
      const res = await startJob({ key: "photo", kind: "image", prompt, aspect: kieRatio(canvases[0].ratio), refs: reference ? [reference] : [] });
      track(res.usage);
      return { job: res.job, reference };
    },
    () => "Started the background photo"
  );

  const done = await waitForJobs(a.step, `photo-${a.round}`, [started.job], {
    first: "12s",
    every: "6s",
    max: 30,
    onRetry: (usage) => logUsage({ agent: "producer", businessId: a.businessId, planId: a.item.plan_id, itemId: a.item.id, mediaId: a.mediaId }, usage, "Made the photo again after a failed try"),
  });
  if (!done) throw new NonRetriableError("Making the photo took too long. Try again.");
  // Our own copy of the photo: the provider's link is temporary and can be slow
  const photoUrl = await a.task(`keep-photo-${a.round}`, () => keepPhoto(a.db(), a.businessId, a.mediaId, done[0].url!, `photo-r${a.round}`), () => "Saved the background photo");

  return a.task(
    `render-${a.round}`,
    async () => {
      const theme = await loadTheme(a.db());
      const Template = AD_TEMPLATES[brief.layout];
      const files: Produced["canvases"] = [];
      for (const [i, canvas] of canvases.entries()) {
        const png = await renderPng(
          Template({ canvas, theme, photoUrl, headline: brief.headline, subhead: brief.subhead, cta: brief.cta.label, badge: brief.badge?.text ?? null }),
          canvas,
          theme
        );
        const key = dated(a.businessId, "images", a.mediaId, `${canvas.ratio.replace(":", "x")}-r${a.round}.png`);
        // The first size is the main file (media.storage_key); the others are renditions
        if (i === 0) await upload(a.db(), key, png, "image/png");
        else await saveFile(a.db(), a.mediaId, "rendition", key, png, "image/png", { aspect_ratio: canvas.ratio });
        files.push({ ratio: canvas.ratio, width: canvas.width, height: canvas.height, key });
      }
      await markMediaReady(a.db(), a.mediaId, files[0].key);
      const url = (key: string) => urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
      return {
        mainKey: files[0].key,
        previewUrls: files.map((f) => url(f.key)),
        photoUrl,
        referenceUrl: started.reference,
        contrast: themePairs(theme).map((p) => ({ name: p.name, ratio: Math.round(contrast(p.bg, p.text) * 100) / 100 })),
        canvases: files,
      } satisfies Produced;
    },
    (r) => `Designed the ad in ${r.canvases.map((c) => c.ratio).join(", ")}`
  );
}
