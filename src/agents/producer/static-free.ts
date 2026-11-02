import { NonRetriableError } from "inngest";
import { contrast } from "@/lib/color";
import type { LogoCorner, StaticBrief } from "@/core/creative/brief";
import { peoplePromptLine } from "@/core/content/prefs";
import { renderPng } from "@/creative/render";
import { FreeAd } from "@/creative/templates/free";
import { loadTheme, themePairs } from "@/creative/theme";
import { finalName, mediaKey, publicUrl, ratioName } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";
import { logUsage } from "@/agents/weekly/task";
import { canvasesFor, kieRatio } from "./canvases";
import { startJob, waitForJobs } from "./kie";
import { keepPhoto, markMediaReady, saveFile } from "./media";
import { cornerIsLight } from "./photo-look";
import { REFERENCE_LINE, photoSettings, referencePhoto, type PhotoSettings, type ReferenceUse } from "./photos";
import { photoWords } from "./picture-only";
import type { ProduceArgs, Produced } from "./types";

// Free image ad: the image model makes the WHOLE ad, words included, from the prompt the Creative
// Director wrote with no template. Code adds only the brand's logo, in the corner the director
// chose, in the version that reads on the picture. One file per platform size.

/**
 * The model's prompt: the director's own words stay as written (including the quoted texts to paint),
 * plus what only the system knows: the owner's photo style and people choice, what the reference photo
 * is for, the plain corner for the logo, and the redo notes.
 */
export function freeAdPrompt(
  prompt: string,
  settings: PhotoSettings,
  reference: ReferenceUse | null,
  fix: string | null | undefined,
  corner: LogoCorner,
  severalSizes: boolean
): string {
  return [
    photoWords(prompt).trim(),
    settings.style ? `Photo style: ${settings.style}.` : "",
    peoplePromptLine(settings.people),
    reference ? REFERENCE_LINE[reference] : "",
    `Leave the ${corner} corner plain and calm (a soft, even background with no words, faces or main subject): the brand's logo is added there afterwards. Do not paint any logo, brand mark or watermark anywhere.`,
    severalSizes ? "Keep every word and the main subject well inside the picture, away from the edges: it is also cropped to other sizes." : "",
    fix ? `Fix these problems from the last attempt: ${fix}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export async function produceStaticFree(a: ProduceArgs, brief: StaticBrief): Promise<Produced> {
  const canvases = canvasesFor("static", a.item.platforms);
  const corner: LogoCorner = brief.logoCorner ?? "top-left";

  const started = await a.task(
    `photo-start-${a.round}`,
    async (track) => {
      const reference = await referencePhoto(a.db(), brief, a.item);
      const prompt = freeAdPrompt(brief.imagePrompt, await photoSettings(a.db()), reference?.use ?? null, a.fix, corner, canvases.length > 1);
      const res = await startJob({ key: "photo", kind: "image", prompt, aspect: kieRatio(canvases[0].ratio), refs: reference ? [reference.url] : [] });
      track(res.usage);
      return { job: res.job, reference: reference?.url ?? null };
    },
    () => "Started the ad picture"
  );

  const done = await waitForJobs(a.step, `photo-${a.round}`, [started.job], {
    first: "12s",
    every: "6s",
    max: 30,
    onRetry: (usage) => logUsage({ agent: "producer", businessId: a.businessId, planId: a.item.plan_id, itemId: a.item.id, mediaId: a.mediaId }, usage, "Made the ad again after a failed try"),
  });
  if (!done) throw new NonRetriableError("Making the ad took too long. Try again.");
  // Our own copy: the provider's link is temporary and can be slow
  const photoUrl = await a.task(`keep-photo-${a.round}`, () => keepPhoto(a.db(), a.businessId, a.mediaId, done[0].url!, `photo-r${a.round}`), () => "Saved the ad picture");

  return a.task(
    `render-${a.round}`,
    async () => {
      const theme = await loadTheme(a.db());
      // The logo version that reads on what is behind it (measured, not guessed)
      const light = await cornerIsLight(photoUrl, corner);
      const files: Produced["canvases"] = [];
      for (const [i, canvas] of canvases.entries()) {
        const png = await renderPng(FreeAd({ canvas, theme, photoUrl, corner, light }), canvas, theme);
        const key = mediaKey(a.businessId, a.mediaId, finalName(ratioName(canvas.ratio), a.round, "png"));
        // The first size is the main file (media.storage_key); the others are renditions
        if (i === 0) await upload(key, png, "image/png");
        else await saveFile(a.db(), a.mediaId, "rendition", key, png, "image/png", { aspect_ratio: canvas.ratio });
        files.push({ ratio: canvas.ratio, width: canvas.width, height: canvas.height, key });
      }
      await markMediaReady(a.db(), a.mediaId, files[0].key);
      return {
        mainKey: files[0].key,
        previewUrls: files.map((f) => publicUrl(f.key)),
        photoUrl,
        referenceUrl: started.reference,
        contrast: themePairs(theme).map((p) => ({ name: p.name, ratio: Math.round(contrast(p.bg, p.text) * 100) / 100 })),
        canvases: files,
      } satisfies Produced;
    },
    (r) => `Added the logo (${corner}) in ${r.canvases.map((c) => c.ratio).join(", ")}`
  );
}
