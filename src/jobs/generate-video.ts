import { inngest } from "./client";
import { adoptFinishedMedia } from "@/core/plans/plans";
import { toInngestError } from "./to-inngest-error";
import { businessDb } from "@/lib/supabase/business";
import { getMedia, markReady, markFailed, productNameFor, type Media } from "@/core/media";
import { getProfile } from "@/core/profile";
import { AppError } from "@/core/errors";
import { parseJson } from "@/lib/json";
import { buildVideoScriptPrompt, sceneCountForDuration } from "@/prompts/video-script";
import { buildScenesPrompt } from "@/prompts/video-scenes";
import { withVideoReferenceInstruction } from "@/prompts/image";
import { ai } from "@/providers/ai/registry";
import { assertVideoReady, getJob } from "@/providers/ffmpeg/client";
import { submitComposeJob } from "@/providers/ffmpeg/compose-video";
import { renderPng } from "@/creative/render";
import { CANVAS, type CanvasRatio } from "@/creative/sizes";
import { buildAss } from "@/creative/subtitles";
import { VIDEO_END_CARD, VIDEO_ON_SCREEN_TEXT } from "@/config/video";
import { EndCard } from "@/creative/templates/carousel";
import { loadTheme } from "@/creative/theme";
import { businessKey, storageKeyFor, upload, urlFor } from "@/providers/storage/supabase-storage";
import { NonRetriableError } from "inngest";

const MAX_IMAGE_POLLS = 12; // ~4.5 min
const MAX_VIDEO_POLLS = 25; // ~12.5 min
const MAX_RENDER_POLLS = 30; // ~10 min

const CLIP_STYLE =
  "Cinematic quality, natural color grade, shallow depth of field, smooth slow camera movement only, no cuts within clip, photorealistic, preserve the exact scene composition from the image. The subject does not talk or speak — no lip movement, mouth stays naturally closed or neutral throughout; narration is a separate voiceover added afterward, not something happening on screen.";

interface SceneImage {
  taskId: string;
  url: string | null;
  scene: number;
  prompt: string;
  videoScenario: string;
  retried: boolean;
}

interface SceneClip {
  taskId: string;
  url: string | null;
  scene: number;
  prompt: string;
  imageUrl: string;
  kieDuration: number;
  targetDuration: number;
  retried: boolean;
}

export const generateVideo = inngest.createFunction(
  {
    id: "generate-video",
    retries: 3,
    concurrency: [{ limit: 2, key: "event.data.businessId" }],
    cancelOn: [{ event: "media/deleted", if: "event.data.mediaId == async.data.mediaId && event.data.businessId == async.data.businessId" }],
    onFailure: async ({ event }) => {
      const { businessId } = event.data.event.data;
      const db = businessDb(businessId);
      const msg = event.data.error?.message || "Video generation failed";
      await markFailed(db, event.data.event.data.mediaId, msg);
    },
  },
  { event: "media/generate-video" },
  async ({ event, step }) => {
    const { businessId } = event.data;
    const db = businessDb(businessId);
    // Every step turns AppErrors into retry / stop for Inngest
    const run = <T>(id: string, fn: () => Promise<T>) => step.run(id, () => fn().catch(toInngestError));

    // Before anything is paid for: the video renderer must be connected
    await run("check-video-setup", () => assertVideoReady());

    const media = await step.run("load-media", () => getMedia(db, event.data.mediaId));
    if (!media.idea) throw new NonRetriableError("No idea provided");

    const profile = await step.run("load-profile", () => getProfile(db));
    const productName = await step.run("load-product", () => productNameFor(db, media as Media));

    const durationSec = media.duration_sec || 15;
    const sceneCount = sceneCountForDuration(durationSec);
    const referenceUrl = media.reference_image_key
      ? urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, media.reference_image_key)
      : undefined;
    // The size picked in Create content; scenes are shot portrait, square or landscape and cropped to fit
    const canvas = CANVAS[(media.aspect_ratio as CanvasRatio) ?? "9:16"] ?? CANVAS["9:16"];
    const shotRatio = canvas.ratio === "16:9" ? "16:9" : canvas.ratio === "1:1" ? "1:1" : "9:16";

    // 1. Script, one line per scene
    const script = await run("write-script", async () => {
      const prompt = buildVideoScriptPrompt(media.idea!, profile, {
        durationSec,
        character: media.character || undefined,
        language: media.language || undefined,
        product: productName || undefined,
      });
      const lines = parseJson<{ script: string[] }>((await ai.text(prompt)).data).script;
      if (!Array.isArray(lines) || !lines.length) throw new AppError("Couldn't write the script. Try again.", "UNKNOWN", true);
      return lines.slice(0, sceneCount);
    });

    // 2. One visual prompt per line
    const scenes = await run("plan-scenes", async () => {
      const prompt = buildScenesPrompt(script, profile, { character: media.character || undefined });
      return parseJson<{ visual_prompts: { scene: number; prompt: string; video_scenario: string }[] }>((await ai.text(prompt)).data)
        .visual_prompts;
    });

    // 3. Voice per line, so each scene knows its real spoken length
    const voices = await run("generate-voice", async () => {
      if (!media.voice_id) return null;
      const result: { key: string; durationSec: number; words: { word: string; start: number; end: number }[] }[] = [];
      for (let i = 0; i < script.length; i++) {
        const { data } = await ai.voice(script[i], media.voice_id!, ai.languageCode(media.language));
        const key = businessKey(businessId, `audio/${media.id}/voice-${i}.mp3`);
        await upload(db, key, data.buffer, "audio/mpeg");
        result.push({ key, durationSec: data.durationSec, words: data.words });
      }
      // Track the files so they are cleaned up with the media
      await db.from("media_files").delete().eq("media_id", media.id).eq("role", "voice");
      const { error } = await db
        .from("media_files")
        .insert(result.map((v, i) => ({ media_id: media.id, role: "voice", position: i, storage_key: v.key })));
      if (error) throw error;
      return result;
    });

    // 4. Scene images
    const images: SceneImage[] = await run("create-images", async () => {
      const list: SceneImage[] = [];
      for (const s of scenes) {
        const prompt = referenceUrl ? withVideoReferenceInstruction(s.prompt) : s.prompt;
        const { data: taskId } = await ai.image.create(prompt, shotRatio, referenceUrl ? [referenceUrl] : []);
        list.push({ taskId, url: null, scene: s.scene, prompt: s.prompt, videoScenario: s.video_scenario, retried: false });
      }
      return list;
    });

    let imagesDone = false;
    for (let i = 0; i < MAX_IMAGE_POLLS && !imagesDone; i++) {
      await step.sleep(`wait-images-${i}`, i === 0 ? "30s" : "20s");
      const polled = await run(`poll-images-${i}`, async () => {
        for (const img of images) {
          if (img.url) continue;
          const status = await ai.image.status(img.taskId);
          if (status.state === "success") img.url = ai.task.resultUrl(status);
          if (status.state !== "fail") continue;
          // One retry without the reference image, then give up
          if (img.retried) throw ai.task.error(status, `scene ${img.scene} image`);
          img.taskId = (await ai.image.create(img.prompt, shotRatio)).data;
          img.retried = true;
        }
        return images;
      });
      images.splice(0, images.length, ...polled);
      imagesDone = images.every((img) => img.url);
    }
    if (!imagesDone) throw new NonRetriableError("Making the scene images took too long. Try again.");

    // 5. Scene clips from the images
    const clips: SceneClip[] = await run("create-clips", async () => {
      const list: SceneClip[] = [];
      for (const img of images) {
        const voice = voices?.[img.scene - 1];
        // +0.5s so the stitch never cuts the last word
        const targetDuration = voice ? voice.durationSec + 0.5 : 4;
        // Seedance makes 4–15s; the stitch freezes the last frame for any extra
        const kieDuration = Math.min(15, Math.max(4, Math.ceil(targetDuration)));
        const prompt = `${img.videoScenario} ${CLIP_STYLE}`;
        const { data: taskId } = await ai.video.create(prompt, img.url!, shotRatio, kieDuration);
        list.push({ taskId, url: null, scene: img.scene, prompt, imageUrl: img.url!, kieDuration, targetDuration, retried: false });
      }
      return list;
    });

    let clipsDone = false;
    for (let i = 0; i < MAX_VIDEO_POLLS && !clipsDone; i++) {
      await step.sleep(`wait-clips-${i}`, i === 0 ? "40s" : "30s");
      const polled = await run(`poll-clips-${i}`, async () => {
        for (const clip of clips) {
          if (clip.url) continue;
          const status = await ai.video.status(clip.taskId);
          if (status.state === "success") clip.url = ai.task.resultUrl(status);
          if (status.state !== "fail") continue;
          if (clip.retried) throw ai.task.error(status, `scene ${clip.scene} clip`);
          clip.taskId = (await ai.video.create(clip.prompt, clip.imageUrl, shotRatio, clip.kieDuration)).data;
          clip.retried = true;
        }
        return clips;
      });
      clips.splice(0, clips.length, ...polled);
      clipsDone = clips.every((c) => c.url);
    }
    if (!clipsDone) throw new NonRetriableError("Making the scene clips took too long. Try again.");

    // 6. Captions (from the voice's word timings), end card and music drawn by our code, then one
    // ffmpeg run on our worker that saves the result straight to storage
    const outputKey = storageKeyFor(businessId, "video", media.id);
    const sceneDurations = clips.map((c) => c.targetDuration);
    const parts = await run("video-parts", async () => {
      const theme = await loadTheme(db);
      const starts = sceneDurations.map((_, i) => sceneDurations.slice(0, i).reduce((a, b) => a + b, 0));
      const words = (voices ?? []).flatMap((v, i) => v.words.map((w) => ({ word: w.word, start: starts[i] + w.start, end: starts[i] + w.end })));
      let subtitlesKey: string | null = null;
      if (VIDEO_ON_SCREEN_TEXT && words.length) {
        subtitlesKey = businessKey(businessId, `videos/${media.id}/captions.ass`);
        const ass = buildAss({ canvas, words, font: theme.fonts.heading, highlight: theme.accent.bg, highlightText: theme.accent.text });
        await upload(db, subtitlesKey, Buffer.from(ass, "utf8"), "text/plain");
      }
      let endCardKey: string | null = null;
      if (VIDEO_END_CARD) {
        endCardKey = businessKey(businessId, `videos/${media.id}/end-card.png`);
        await upload(db, endCardKey, await renderPng(EndCard({ canvas, theme, cta: "Learn more", line: null }), canvas, theme), "image/png");
      }
      const font = theme.fontFiles.find((f) => f.family === theme.fonts.heading && f.weight >= 700) ?? theme.fontFiles[0];
      // Videos without a voice get a music bed so they aren't silent
      let musicKey: string | null = null;
      if (!voices) {
        const total = sceneDurations.reduce((a, b) => a + b, 0) + (VIDEO_END_CARD ? 2.5 : 0);
        const music = await ai.music("Upbeat, modern instrumental background music for a short social media video, no vocals.", Math.ceil(total)).catch(() => null);
        if (music) {
          musicKey = businessKey(businessId, `audio/${media.id}/music.mp3`);
          await upload(db, musicKey, music.data, "audio/mpeg");
          await db.from("media_files").insert({ media_id: media.id, role: "music", storage_key: musicKey });
        }
      }
      return { subtitlesKey, endCardKey, fontKeys: subtitlesKey && font ? [font.key] : [], musicKey };
    });

    const renderId = await run("compose", () =>
      submitComposeJob({
        width: canvas.width,
        height: canvas.height,
        clipUrls: clips.map((c) => c.url!),
        sceneDurations,
        voiceKeys: voices ? clips.map((c) => voices[c.scene - 1].key) : null,
        musicKey: parts.musicKey,
        subtitlesKey: parts.subtitlesKey,
        fontKeys: parts.fontKeys,
        endCardKey: parts.endCardKey,
        outputKey,
      })
    );

    let rendered = false;
    for (let i = 0; i < MAX_RENDER_POLLS && !rendered; i++) {
      await step.sleep(`wait-render-${i}`, "20s");
      rendered = await run(`poll-render-${i}`, async () => {
        const job = await getJob(renderId);
        if (job.status === "failed") {
          throw new AppError(`The video couldn't be put together: "${job.error ?? "unknown"}". Try again.`, "UNKNOWN", false);
        }
        return job.status === "done";
      });
    }
    if (!rendered) throw new NonRetriableError("Putting the video together took too long. Try again.");

    await step.run("finalize", async () => {
      await markReady(db, media.id, outputKey);
      // A planned post's media made here: the post picks it up (as needing a look)
      await adoptFinishedMedia(db, media.id);
    });
    return { success: true, mediaId: media.id };
  }
);
