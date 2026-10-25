import { inngest } from "./client";
import { toInngestError } from "./to-inngest-error";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMedia, markReady, markFailed, productNameFor, type Media } from "@/core/media";
import { getProfile } from "@/core/profile";
import { AppError } from "@/core/errors";
import { parseJson } from "@/lib/json";
import { buildVideoScriptPrompt, sceneCountForDuration } from "@/prompts/video-script";
import { buildScenesPrompt } from "@/prompts/video-scenes";
import { withVideoReferenceInstruction } from "@/prompts/image";
import { ai } from "@/providers/ai/registry";
import { getJob } from "@/providers/ffmpeg/client";
import { submitSceneStitchJob } from "@/providers/ffmpeg/stitch-scenes";
import { storageKeyFor, upload, urlFor } from "@/providers/storage/supabase-storage";
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
    concurrency: [{ limit: 2 }],
    cancelOn: [{ event: "media/deleted", match: "data.mediaId" }],
    onFailure: async ({ event }) => {
      const db = createAdminClient();
      const msg = event.data.error?.message || "Video generation failed";
      await markFailed(db, event.data.event.data.mediaId, msg);
    },
  },
  { event: "media/generate-video" },
  async ({ event, step }) => {
    const db = createAdminClient();
    // Every step turns AppErrors into retry / stop for Inngest
    const run = <T>(id: string, fn: () => Promise<T>) => step.run(id, () => fn().catch(toInngestError));

    const media = await step.run("load-media", () => getMedia(db, event.data.mediaId));
    if (!media.idea) throw new NonRetriableError("No idea provided");

    const profile = await step.run("load-profile", () => getProfile(db));
    const productName = await step.run("load-product", () => productNameFor(db, media as Media));

    const durationSec = media.duration_sec || 15;
    const sceneCount = sceneCountForDuration(durationSec);
    const referenceUrl = media.reference_image_key
      ? urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, media.reference_image_key)
      : undefined;

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
      const result: { key: string; durationSec: number }[] = [];
      for (let i = 0; i < script.length; i++) {
        const { data } = await ai.voice(script[i], media.voice_id!, ai.languageCode(media.language));
        const key = `audio/${media.id}/voice-${i}.mp3`;
        await upload(db, key, data.buffer, "audio/mpeg");
        result.push({ key, durationSec: data.durationSec });
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
        const { data: taskId } = await ai.image.create(prompt, "9:16", referenceUrl ? [referenceUrl] : []);
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
          img.taskId = (await ai.image.create(img.prompt, "9:16")).data;
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
        const { data: taskId } = await ai.video.create(prompt, img.url!, "9:16", kieDuration);
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
          clip.taskId = (await ai.video.create(clip.prompt, clip.imageUrl, "9:16", clip.kieDuration)).data;
          clip.retried = true;
        }
        return clips;
      });
      clips.splice(0, clips.length, ...polled);
      clipsDone = clips.every((c) => c.url);
    }
    if (!clipsDone) throw new NonRetriableError("Making the scene clips took too long. Try again.");

    // 6. Stitch on our worker; it saves the result straight to storage
    const outputKey = storageKeyFor("video", media.id);
    const renderId = await run("stitch", () =>
      submitSceneStitchJob({
        clipUrls: clips.map((c) => c.url!),
        clipDurations: clips.map((c) => c.targetDuration),
        audioKeys: voices ? clips.map((c) => voices[c.scene - 1].key) : null,
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

    await step.run("finalize", () => markReady(db, media.id, outputKey));
    return { success: true, mediaId: media.id };
  }
);
