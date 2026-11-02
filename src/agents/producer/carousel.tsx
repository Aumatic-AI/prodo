import { NonRetriableError } from "inngest";
import { contrast } from "@/lib/color";
import type { CarouselBrief } from "@/core/creative/brief";
import { renderPng } from "@/creative/render";
import { ContentSlide, CoverSlide, CtaSlide } from "@/creative/templates/carousel";
import { loadTheme, themePairs } from "@/creative/theme";
import { linkText } from "@/creative/video/parts";
import { finalName, mediaKey, publicUrl } from "@/providers/storage/paths";
import { logUsage } from "@/agents/weekly/task";
import { canvasesFor, kieRatio } from "./canvases";
import { startJob, waitForJobs } from "./kie";
import { keepPhoto, markMediaReady, saveFile } from "./media";
import { adPhotoPrompt, photoSettings, referencePhoto } from "./photos";
import type { ProduceArgs, Produced } from "./types";

// Carousel: one AI cover photo → our code designs the hook cover, the content slides and the
// call-to-action slide. One media row; each slide is a media_files row (role slide).

export async function produceCarousel(a: ProduceArgs, brief: CarouselBrief): Promise<Produced> {
  const canvas = canvasesFor("carousel", a.item.platforms)[0];

  const started = await a.task(
    `cover-start-${a.round}`,
    async (track) => {
      const reference = await referencePhoto(a.db(), brief, a.item);
      // The cover shows the hook over its lower third
      const prompt = adPhotoPrompt(brief.imagePrompt, await photoSettings(a.db()), reference?.use ?? null, a.fix, "Compose so the bottom third of the frame is simple, with the subject clear of it.");
      const res = await startJob({ key: "cover", kind: "image", prompt, aspect: kieRatio(canvas.ratio), refs: reference ? [reference.url] : [] });
      track(res.usage);
      return { job: res.job, reference: reference?.url ?? null };
    },
    () => "Started the cover photo"
  );

  const done = await waitForJobs(a.step, `cover-${a.round}`, [started.job], {
    first: "12s",
    every: "6s",
    max: 30,
    onRetry: (usage) => logUsage({ agent: "producer", businessId: a.businessId, planId: a.item.plan_id, itemId: a.item.id, mediaId: a.mediaId }, usage, "Made the cover photo again after a failed try"),
  });
  if (!done) throw new NonRetriableError("Making the cover photo took too long. Try again.");
  // Our own copy of the photo: the provider's link is temporary and can be slow
  const photoUrl = await a.task(`keep-cover-${a.round}`, () => keepPhoto(a.db(), a.businessId, a.mediaId, done[0].url!, `cover-r${a.round}`), () => "Saved the cover photo");

  return a.task(
    `slides-${a.round}`,
    async () => {
      const [theme, { data: profile, error }] = await Promise.all([loadTheme(a.db()), a.db().from("business_profile").select("website, cta_links").single()]);
      if (error) throw error;
      // Where the call to action leads, as people read it ("royal-gypsy.com")
      const links: Record<string, string> = { website: profile?.website ?? "", ...(profile?.cta_links ?? {}) };
      const link = linkText(links[brief.cta.link] || links.website) || null;
      const slides = brief.slides;
      const total = slides.length;
      await a.db().from("media_files").delete().eq("media_id", a.mediaId).eq("role", "slide");

      const keys: string[] = [];
      for (const [i, s] of slides.entries()) {
        const element =
          i === 0 ? (
            <CoverSlide canvas={canvas} theme={theme} index={0} total={total} photoUrl={photoUrl} title={s.title} />
          ) : i === total - 1 ? (
            <CtaSlide canvas={canvas} theme={theme} index={i} total={total} title={s.title} body={s.body} cta={brief.cta.label} link={link} />
          ) : (
            <ContentSlide canvas={canvas} theme={theme} index={i} total={total} title={s.title} body={s.body} />
          );
        const png = await renderPng(element, canvas, theme);
        const key = mediaKey(a.businessId, a.mediaId, finalName(`slide-${String(i + 1).padStart(2, "0")}`, a.round, "png"));
        await saveFile(a.db(), a.mediaId, "slide", key, png, "image/png", { position: i, aspect_ratio: canvas.ratio });
        keys.push(key);
      }
      // The cover is the main file
      await markMediaReady(a.db(), a.mediaId, keys[0]);
      const url = (key: string) => publicUrl(key);
      return {
        mainKey: keys[0],
        previewUrls: keys.map(url),
        photoUrl,
        referenceUrl: started.reference,
        contrast: themePairs(theme).map((p) => ({ name: p.name, ratio: Math.round(contrast(p.bg, p.text) * 100) / 100 })),
        canvases: keys.map((key) => ({ ratio: canvas.ratio, width: canvas.width, height: canvas.height, key })),
      } satisfies Produced;
    },
    (r) => `Designed ${r.canvases.length} slides`
  );
}
