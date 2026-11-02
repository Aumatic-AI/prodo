import { NonRetriableError } from "inngest";
import { contrast } from "@/lib/color";
import type { StaticBrief } from "@/core/creative/brief";
import { renderPng } from "@/creative/render";
import { AD_TEMPLATES } from "@/creative/templates/ads";
import { LAYOUT_PHOTO } from "@/creative/templates/notes";
import { linkText } from "@/creative/video/parts";
import { loadTheme, themePairs } from "@/creative/theme";
import { finalName, mediaKey, publicUrl, ratioName } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";
import { logUsage } from "@/agents/weekly/task";
import { canvasesFor, kieRatio } from "./canvases";
import { startJob, waitForJobs } from "./kie";
import { keepPhoto, markMediaReady, saveFile } from "./media";
import { photoLook } from "./photo-look";
import { adPhotoPrompt, photoSettings, referencePhoto } from "./photos";
import type { ProduceArgs, Produced } from "./types";

// Static ad: one AI photo (with the real product as reference, framed for the layout) → one look at
// the finished photo (its calm side, the subject, how light its edges are) → our layout draws the
// headline, subhead, price, call to action and logo around it → one file per platform size.

export async function produceStatic(a: ProduceArgs, brief: StaticBrief): Promise<Produced> {
  const canvases = canvasesFor("static", a.item.platforms);

  const started = await a.task(
    `photo-start-${a.round}`,
    async (track) => {
      const reference = await referencePhoto(a.db(), brief, a.item);
      const prompt = adPhotoPrompt(brief.imagePrompt, await photoSettings(a.db()), reference?.use ?? null, a.fix, LAYOUT_PHOTO[brief.layout]);
      const res = await startJob({ key: "photo", kind: "image", prompt, aspect: kieRatio(canvases[0].ratio), refs: reference ? [reference.url] : [] });
      track(res.usage);
      return { job: res.job, reference: reference?.url ?? null };
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

  // Where the words can go and where the subject is, so the layout works around this photo
  const look = await a.task(
    `photo-look-${a.round}`,
    async (track) => {
      const res = await photoLook(photoUrl);
      track(res.usage);
      return res.look;
    },
    (l) => `Found the photo's calm side (${l.zone}) and its subject`
  );

  return a.task(
    `render-${a.round}`,
    async () => {
      const [theme, { data: profile, error }] = await Promise.all([loadTheme(a.db()), a.db().from("business_profile").select("website, cta_links").single()]);
      if (error) throw error;
      // Where the call to action leads, as people read it ("royal-gypsy.com"): nothing in the image is clickable
      const links: Record<string, string> = { website: profile?.website ?? "", ...(profile?.cta_links ?? {}) };
      const link = linkText(links[brief.cta.link] || links.website) || null;
      const Template = AD_TEMPLATES[brief.layout];
      const files: Produced["canvases"] = [];
      for (const [i, canvas] of canvases.entries()) {
        const png = await renderPng(
          Template({ canvas, theme, photoUrl, headline: brief.headline, subhead: brief.subhead, cta: brief.cta.label, link, badge: brief.badge?.text ?? null, design: brief.design, photo: look }),
          canvas,
          theme
        );
        const key = mediaKey(a.businessId, a.mediaId, finalName(ratioName(canvas.ratio), a.round, "png"));
        // The first size is the main file (media.storage_key); the others are renditions
        if (i === 0) await upload(key, png, "image/png");
        else await saveFile(a.db(), a.mediaId, "rendition", key, png, "image/png", { aspect_ratio: canvas.ratio });
        files.push({ ratio: canvas.ratio, width: canvas.width, height: canvas.height, key });
      }
      await markMediaReady(a.db(), a.mediaId, files[0].key);
      const url = (key: string) => publicUrl(key);
      return {
        mainKey: files[0].key,
        previewUrls: files.map((f) => url(f.key)),
        photoUrl,
        referenceUrl: started.reference,
        contrast: themePairs(theme).map((p) => ({ name: p.name, ratio: Math.round(contrast(p.bg, p.text) * 100) / 100 })),
        canvases: files,
      } satisfies Produced;
    },
    (r) => `Designed the ad (${brief.layout}) in ${r.canvases.map((c) => c.ratio).join(", ")}`
  );
}
