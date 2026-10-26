import { NonRetriableError } from "inngest";
import type { VideoBrief } from "@/core/creative/brief";
import { contrast } from "@/lib/color";
import { renderPng } from "@/creative/render";
import { CANVAS } from "@/creative/sizes";
import { buildAss, type TimedWord } from "@/creative/subtitles";
import { EndCard } from "@/creative/templates/carousel";
import { loadTheme, themePairs } from "@/creative/theme";
import { ai } from "@/providers/ai/registry";
import { getJob } from "@/providers/ffmpeg/client";
import { submitComposeJob } from "@/providers/ffmpeg/compose-video";
import { businessKey, upload, urlFor } from "@/providers/storage/supabase-storage";
import { logUsage } from "@/agents/weekly/task";
import { optional } from "@/agents/run";
import { canvasesFor } from "./canvases";
import { startJob, waitForJobs, type KieJob } from "./kie";
import { dated, markMediaReady, saveFile } from "./media";
import { photoPrompt, photoStyle, referencePhoto } from "./photos";
import type { ProduceArgs, Produced } from "./types";

// Video: voice per scene (with word timings) → scene images (real photo as reference) → clips →
// music → captions, on-screen lines and end card drawn by our code → one ffmpeg run per size on
// our worker (9:16, plus 4:5 for feed platforms), loudness normalised.
// A QA redo makes only the failed scenes again and keeps the rest.

const CLIP_STYLE =
  "Cinematic, natural colour grade, smooth camera movement only, no cuts, photorealistic, keep the exact composition of the image. Nobody talks or moves their lips. No text, letters or logos.";
const END_CARD_SEC = 2.5;
const MAX_RENDER_POLLS = 40;

/** What carries over between rounds, so a redo only remakes failed scenes. */
export interface VideoState {
  voices: { key: string; durationSec: number; words: TimedWord[] }[];
  sceneDurations: number[];
  images: (string | null)[];
  clips: (string | null)[];
  musicKey: string | null;
}

const languageCode = (lang: string | null) => (lang && /^[a-z]{2}$/i.test(lang) ? lang.toLowerCase() : undefined);

export async function produceVideo(a: ProduceArgs, brief: VideoBrief, previous: VideoState | null, redoScenes: number[] | null): Promise<{ produced: Produced; state: VideoState }> {
  const canvases = canvasesFor("video", a.item.platforms);
  const scope = { agent: "producer" as const, businessId: a.businessId, planId: a.item.plan_id, itemId: a.item.id, mediaId: a.mediaId };
  const onRetry = (usage: Parameters<typeof logUsage>[1]) => logUsage(scope, usage, "Made a scene again after a failed try");

  // 1. Voice per scene: real spoken length and word timings for captions
  const voices =
    previous?.voices ??
    (await a.task(
      `voice-${a.round}`,
      async (track) => {
        const { data: profile } = await a.db().from("business_profile").select("voice_id, language").single();
        const out: VideoState["voices"] = [];
        for (const [i, scene] of brief.scenes.entries()) {
          const res = await ai.voice(scene.voiceover, profile?.voice_id ?? undefined, languageCode(profile?.language ?? null));
          track(res.usage);
          const key = businessKey(a.businessId, `audio/${a.mediaId}/voice-${i}.mp3`);
          await saveFile(a.db(), a.mediaId, "voice", key, res.data.buffer, "audio/mpeg", { position: i });
          out.push({ key, durationSec: res.data.durationSec, words: res.data.words });
        }
        return out;
      },
      (r) => `Recorded the voice-over: ${r.length} scenes, ${Math.round(r.reduce((s, v) => s + v.durationSec, 0))} seconds`
    ));
  // Each scene lasts its speech plus a breath
  const sceneDurations = previous?.sceneDurations ?? voices.map((v) => Math.max(2.5, Math.round((v.durationSec + 0.35) * 100) / 100));
  const redo = new Set(redoScenes ?? brief.scenes.map((_, i) => i));

  // 2. Scene images for the scenes being made
  const imageJobs = await a.task(
    `scene-images-${a.round}`,
    async (track) => {
      const reference = await referencePhoto(a.db(), brief, a.item);
      const style = await photoStyle(a.db());
      const jobs: KieJob[] = [];
      for (const [i, scene] of brief.scenes.entries()) {
        if (!redo.has(i)) continue;
        // The real product or person anchors the first and last scenes
        const ref = reference && (i === 0 || i === brief.scenes.length - 1) ? reference : null;
        const res = await startJob({ key: `scene-${i + 1}`, kind: "image", prompt: photoPrompt(scene.visual, style, !!ref, a.fix), aspect: "9:16", refs: ref ? [ref] : [] });
        track(res.usage);
        jobs.push(res.job);
      }
      return jobs;
    },
    (r) => `Started ${r.length} scene images`
  );
  const images = await waitForJobs(a.step, `scene-images-${a.round}`, imageJobs, { first: "25s", every: "15s", max: 20, onRetry });
  if (!images) throw new NonRetriableError("Making the scene images took too long. Try again.");

  // 3. Clips from the images
  const clipJobs = await a.task(
    `scene-clips-${a.round}`,
    async (track) => {
      const jobs: KieJob[] = [];
      for (const img of images) {
        const i = Number(img.key.split("-")[1]) - 1;
        const scene = brief.scenes[i];
        const duration = Math.min(15, Math.max(4, Math.ceil(sceneDurations[i])));
        const res = await startJob({ key: img.key, kind: "video", prompt: `${scene.motion}. ${scene.visual} ${CLIP_STYLE}`, aspect: "9:16", refs: [], firstFrame: img.url, duration });
        track(res.usage);
        jobs.push(res.job);
      }
      return jobs;
    },
    (r) => `Started ${r.length} scene clips`
  );
  const clips = await waitForJobs(a.step, `scene-clips-${a.round}`, clipJobs, { first: "45s", every: "30s", max: 25, onRetry });
  if (!clips) throw new NonRetriableError("Making the scene clips took too long. Try again.");

  const state: VideoState = {
    voices,
    sceneDurations,
    images: brief.scenes.map((_, i) => images.find((j) => j.key === `scene-${i + 1}`)?.url ?? previous?.images[i] ?? null),
    clips: brief.scenes.map((_, i) => clips.find((j) => j.key === `scene-${i + 1}`)?.url ?? previous?.clips[i] ?? null),
    musicKey: previous?.musicKey ?? null,
  };
  const total = sceneDurations.reduce((s, d) => s + d, 0);

  // 4. Music bed (the video still works without it)
  if (!previous) {
    state.musicKey = await optional(
      a.task(
        `music-${a.round}`,
        async (track) => {
          const res = await ai.music(`${brief.musicMood}. Instrumental background music for a short social media ad, no vocals, steady energy.`, Math.ceil(total + END_CARD_SEC));
          track(res.usage);
          const key = businessKey(a.businessId, `audio/${a.mediaId}/music.mp3`);
          await saveFile(a.db(), a.mediaId, "music", key, res.data, "audio/mpeg");
          return key;
        },
        () => "Made the background music"
      )
    );
  }

  // 5. Captions, on-screen lines and end card per size, drawn by our code
  const parts = await a.task(
    `video-parts-${a.round}`,
    async () => {
      const theme = await loadTheme(a.db());
      const starts = sceneDurations.map((_, i) => sceneDurations.slice(0, i).reduce((s, d) => s + d, 0));
      const words: TimedWord[] = voices.flatMap((v, i) => v.words.map((w) => ({ word: w.word, start: starts[i] + w.start, end: starts[i] + w.end })));
      const overlays = brief.scenes.map((s, i) => ({
        text: i === 0 ? s.overlay || brief.hook.text : s.overlay,
        start: starts[i],
        end: i === 0 ? Math.min(starts[i] + sceneDurations[i], 2.4) : starts[i] + sceneDurations[i],
      }));
      const captionFont = theme.fontFiles.find((f) => f.family === theme.fonts.heading && f.weight >= 700) ?? theme.fontFiles[0];
      const out: Record<string, { subtitles: string; endCard: string }> = {};
      for (const canvas of canvases) {
        const tag = `${canvas.ratio.replace(":", "x")}-r${a.round}`;
        const ass = buildAss({ canvas, words, overlays, font: theme.fonts.heading, highlight: theme.accent.bg, highlightText: theme.accent.text });
        const subtitles = dated(a.businessId, "videos", a.mediaId, `captions-${tag}.ass`);
        await upload(a.db(), subtitles, Buffer.from(ass, "utf8"), "text/plain");
        const card = await renderPng(<EndCard canvas={canvas} theme={theme} cta={brief.cta.label} line={brief.message.length <= 70 ? brief.message : null} />, canvas, theme);
        const endCard = dated(a.businessId, "videos", a.mediaId, `end-card-${tag}.png`);
        await upload(a.db(), endCard, card, "image/png");
        out[canvas.ratio] = { subtitles, endCard };
      }
      return {
        files: out,
        fontKeys: captionFont ? [captionFont.key] : [],
        contrast: themePairs(theme).map((p) => ({ name: p.name, ratio: Math.round(contrast(p.bg, p.text) * 100) / 100 })),
      };
    },
    () => "Drew the captions, on-screen text and end card"
  );

  // 6. One ffmpeg run per size on our worker
  const renders = await a.task(
    `compose-${a.round}`,
    async () => {
      const jobs: { ratio: string; jobId: string; key: string }[] = [];
      for (const canvas of canvases) {
        const key = dated(a.businessId, "videos", a.mediaId, `${canvas.ratio.replace(":", "x")}-r${a.round}.mp4`);
        const jobId = await submitComposeJob({
          width: canvas.width,
          height: canvas.height,
          clipUrls: state.clips.map((c) => c!),
          sceneDurations,
          voiceKeys: voices.map((v) => v.key),
          musicKey: state.musicKey,
          subtitlesKey: parts.files[canvas.ratio].subtitles,
          fontKeys: parts.fontKeys,
          endCardKey: parts.files[canvas.ratio].endCard,
          endCardSec: END_CARD_SEC,
          outputKey: key,
        });
        jobs.push({ ratio: canvas.ratio, jobId, key });
      }
      return jobs;
    },
    (r) => `Sent ${r.length} ${r.length === 1 ? "size" : "sizes"} to the video renderer`
  );

  let finished = false;
  for (let i = 0; i < MAX_RENDER_POLLS && !finished; i++) {
    await a.step.sleep(`render-${a.round}-wait-${i}`, i === 0 ? "30s" : "15s");
    finished = await a.step.run(`render-${a.round}-poll-${i}`, async () => {
      const states = await Promise.all(renders.map((r) => getJob(r.jobId)));
      const failed = states.find((s) => s.status === "failed");
      if (failed) throw new NonRetriableError(`The video couldn't be put together: ${failed.error ?? "unknown error"}. Try again.`);
      return states.every((s) => s.status === "done");
    });
  }
  if (!finished) throw new NonRetriableError("Putting the video together took too long. Try again.");

  const produced = await a.task(
    `video-finish-${a.round}`,
    async () => {
      await a.db().from("media_files").delete().eq("media_id", a.mediaId).eq("role", "rendition");
      for (const r of renders.slice(1)) {
        await a.db().from("media_files").insert({ media_id: a.mediaId, role: "rendition", storage_key: r.key, aspect_ratio: r.ratio });
      }
      await a.db().from("media").update({ duration_sec: Math.round(total + END_CARD_SEC) }).eq("id", a.mediaId);
      await markMediaReady(a.db(), a.mediaId, renders[0].key);
      const starts = sceneDurations.map((_, i) => sceneDurations.slice(0, i).reduce((s, d) => s + d, 0));
      return {
        mainKey: renders[0].key,
        previewUrls: renders.map((r) => urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, r.key)),
        photoUrl: state.images[0],
        referenceUrl: null,
        contrast: parts.contrast,
        canvases: renders.map((r) => ({ ratio: r.ratio, width: CANVAS[r.ratio as "9:16"].width, height: CANVAS[r.ratio as "9:16"].height, key: r.key })),
        durationSec: Math.round((total + END_CARD_SEC) * 10) / 10,
        scenes: brief.scenes.map((s, i) => ({ index: i, start: starts[i], end: starts[i] + sceneDurations[i], visual: s.visual, voiceover: s.voiceover })),
      } satisfies Produced;
    },
    (r) => `Finished the video: ${r.durationSec} seconds in ${r.canvases.map((c) => c.ratio).join(" and ")}`
  );

  return { produced, state };
}
