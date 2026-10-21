import { inngest } from "./client";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMedia, markReady, markFailed } from "@/core/media";
import { getProfile } from "@/core/profile";
import { buildVideoScriptPrompt, sceneCountForDuration } from "@/prompts/video-script";
import { buildScenesPrompt } from "@/prompts/video-scenes";
import { withVideoReferenceInstruction } from "@/prompts/image";
import * as OpenAI from "@/providers/ai/openai";
import * as Kie from "@/providers/ai/kie";
import * as ElevenLabs from "@/providers/ai/elevenlabs";
import * as FFmpeg from "@/providers/ffmpeg/client";
import { submitSceneStitchJob, downloadAndStore } from "@/providers/ffmpeg/stitch-scenes";
import { storageKeyFor, urlFor } from "@/providers/storage/supabase-storage";
import { NonRetriableError } from "inngest";

export const generateVideo = inngest.createFunction(
  {
    id: "generate-video",
    retries: 3,
    concurrency: [{ limit: 2 }],
    cancelOn: [{ event: "media/deleted", match: "data.mediaId" }],
    onFailure: async ({ event }) => {
      const db = createAdminClient();
      const mediaId = event.data.event.data.mediaId;
      const msg = event.data.error?.message || "Video generation failed";
      await markFailed(db, mediaId, msg);
    },
  },
  { event: "media/generate-video" },
  async ({ event, step }) => {
    const db = createAdminClient();

    const media = await step.run("load-media", () => getMedia(db, event.data.mediaId));
    if (!media.idea) throw new NonRetriableError("No idea provided");

    const profile = await step.run("load-profile", () => getProfile(db));

    const durationSec = media.duration_sec || 15;
    const sceneCount = sceneCountForDuration(durationSec);
    const referenceUrl = media.reference_image_key
      ? urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, media.reference_image_key)
      : undefined;

    // 1. Generate narration script via OpenAI
    const scriptJson = await step.run("write-script", async () => {
      const prompt = buildVideoScriptPrompt(media.idea!, profile, {
        durationSec,
        character: media.character || undefined,
        language: media.language || undefined,
        product: media.product || undefined,
      });
      const response = await OpenAI.generateText(prompt);
      const parsed = OpenAI.parseJsonResponse(response);
      if (Array.isArray(parsed.script) && parsed.script.length > sceneCount) {
        parsed.script = parsed.script.slice(0, sceneCount);
      }
      return parsed as { script: string[] };
    });

    // 2. Generate visual prompts per scene via OpenAI
    const visualPromptsJson = await step.run("plan-scenes", async () => {
      const prompt = buildScenesPrompt(scriptJson.script, profile, {
        character: media.character || undefined,
      });
      const response = await OpenAI.generateText(prompt);
      return OpenAI.parseJsonResponse(response) as {
        visual_prompts: { scene: number; prompt: string; video_scenario: string }[];
      };
    });

    // 3. Generate narration via ElevenLabs — one call per scene line (not
    // one joined call for the whole script), so each clip's real spoken
    // length is known and can size its own scene instead of every scene
    // sharing one flat guessed duration.
    const sceneAudios = await step.run("generate-audio", async () => {
      if (!media.voice_id) return null;
      const results: { url: string; durationSec: number }[] = [];
      for (let i = 0; i < scriptJson.script.length; i++) {
        const { buffer, durationSec } = await ElevenLabs.generateSpeech(
          scriptJson.script[i],
          media.voice_id!,
          ElevenLabs.languageCode(media.language)
        );
        const key = `audio/${media.id}_${i}_${Date.now()}.mp3`;
        const { error } = await db.storage
          .from("media")
          .upload(key, buffer, { contentType: "audio/mpeg" });
        if (error) throw new Error("Audio upload failed: " + error.message);
        const { data } = db.storage.from("media").getPublicUrl(key);
        results.push({ url: data.publicUrl, durationSec });
      }
      return results;
    });

    // 4. Trigger per-scene image generation
    const imageJobs = await step.run("trigger-images", async () => {
      const jobs = [];
      for (const vp of visualPromptsJson.visual_prompts) {
        const scenePrompt = referenceUrl ? withVideoReferenceInstruction(vp.prompt) : vp.prompt;
        const id = await Kie.createImageTask(scenePrompt, "9:16", referenceUrl ? [referenceUrl] : undefined);
        jobs.push({
          id,
          url: null as string | null,
          scene: vp.scene,
          imagePrompt: vp.prompt,
          videoScenario: vp.video_scenario,
          fellBack: false,
        });
      }
      return jobs;
    });

    // 5. Poll for all scene images (up to 12 attempts, ~4.5 min)
    let imagesDone = false;
    let imgAttempts = 0;
    const MAX_IMAGE_ATTEMPTS = 12;

    while (!imagesDone && imgAttempts < MAX_IMAGE_ATTEMPTS) {
      await step.sleep(`wait-img-${imgAttempts}`, imgAttempts === 0 ? "30s" : "20s");

      const result = await step.run(`poll-img-${imgAttempts}`, async () => {
        let pending = false;
        for (const job of imageJobs) {
          if (job.url) continue;
          const status = await Kie.checkTaskStatus(job.id);
          if (status.state === "success") {
            job.url = Kie.parseResultUrl(status.resultJson);
            if (!job.url) pending = true;
          } else if (status.state === "fail") {
            if (!job.fellBack) {
              job.id = await Kie.createImageTask(job.imagePrompt, "9:16");
              job.fellBack = true;
            } else {
              throw new Error(`Scene ${job.scene} image rejected twice: ${status.failMsg || "unknown"}`);
            }
            pending = true;
          } else {
            pending = true;
          }
        }
        return { imageJobs, allComplete: !pending };
      });

      for (let i = 0; i < imageJobs.length; i++) imageJobs[i] = result.imageJobs[i];
      imagesDone = result.allComplete;
      imgAttempts++;
    }

    if (!imagesDone) throw new Error("Scene image generation timed out");

    // 6. Trigger per-scene video generation (image-to-video)
    const videoJobs = await step.run("trigger-videos", async () => {
      const jobs = [];
      for (const imgJob of imageJobs) {
        const audio = sceneAudios?.[imgJob.scene - 1];
        // +0.5s tail buffer: the alignment timestamp marks the end of the
        // last spoken character, and the raw clip can run a touch longer
        // than that (trailing consonant/breath) — pad so atrim never
        // clips real speech off in the stitch step below.
        const targetDuration = audio ? audio.durationSec + 0.5 : 4;
        // Kie's model only needs to generate real motion up to its own
        // duration ceiling — any gap beyond that is covered by the stitch
        // step's freeze-pad, so this is just "ask for as much real motion
        // as the model allows", not the authoritative scene length.
        // Seedance 2 Mini's documented range is 4-15s.
        const kieDuration = String(Math.min(15, Math.max(4, Math.ceil(targetDuration))));
        const cinematicPrompt = `${imgJob.videoScenario} Cinematic quality, natural color grade, shallow depth of field, smooth slow camera movement only, no cuts within clip, photorealistic, preserve the exact scene composition from the image. The subject does not talk or speak — no lip movement, mouth stays naturally closed or neutral throughout; narration is a separate voiceover added afterward, not something happening on screen.`;
        const id = await Kie.createVideoTask(cinematicPrompt, [imgJob.url!], "9:16", kieDuration);
        jobs.push({
          id,
          url: null as string | null,
          scene: imgJob.scene,
          cinematicPrompt,
          sourceImageUrl: imgJob.url!,
          kieDuration,
          targetDuration,
          resubmitted: false,
        });
      }
      return jobs;
    });

    // 7. Poll for all scene videos (up to 25 attempts, ~12.5 min)
    let videosDone = false;
    let vidAttempts = 0;
    const MAX_VIDEO_ATTEMPTS = 25;

    while (!videosDone && vidAttempts < MAX_VIDEO_ATTEMPTS) {
      await step.sleep(`wait-vid-${vidAttempts}`, vidAttempts === 0 ? "40s" : "30s");

      const result = await step.run(`poll-vid-${vidAttempts}`, async () => {
        let pending = false;
        for (const job of videoJobs) {
          if (job.url) continue;
          const status = await Kie.checkTaskStatus(job.id);
          if (status.state === "success") {
            job.url = Kie.parseResultUrl(status.resultJson);
            if (!job.url) pending = true;
          } else if (status.state === "fail") {
            if (!job.resubmitted) {
              job.id = await Kie.createVideoTask(job.cinematicPrompt, [job.sourceImageUrl], "9:16", job.kieDuration);
              job.resubmitted = true;
            } else {
              throw new Error(`Scene ${job.scene} video rejected twice: ${status.failMsg || "unknown"}`);
            }
            pending = true;
          } else {
            pending = true;
          }
        }
        return { videoJobs, allComplete: !pending };
      });

      for (let i = 0; i < videoJobs.length; i++) videoJobs[i] = result.videoJobs[i];
      videosDone = result.allComplete;
      vidAttempts++;
    }

    if (!videosDone) throw new Error("Scene video generation timed out");

    const clipUrls = videoJobs.map((j) => j.url!);
    const clipDurations = videoJobs.map((j) => j.targetDuration);
    const audioUrls = sceneAudios ? videoJobs.map((j) => sceneAudios![j.scene - 1].url) : null;

    // 8. Stitch scenes via FFmpeg API — each clip is forced to its own
    // scene's real narration length (not a flat shared guess), so the
    // merged video can never cut off mid-script.
    const stitchJobId = await step.run("stitch", () =>
      submitSceneStitchJob({ clipUrls, clipDurations, audioUrls })
    );

    // 9. Poll for stitching (up to 15 attempts, ~5 min)
    let stitchedUrl = "";
    let stitchAttempts = 0;

    while (!stitchedUrl && stitchAttempts < 15) {
      await step.sleep(`wait-stitch-${stitchAttempts}`, "20s");

      const result = await step.run(`poll-stitch-${stitchAttempts}`, async () => {
        const status = await FFmpeg.checkStatus(stitchJobId);
        if (status.status === "finished") return { url: status.url!, done: true };
        if (status.status === "failed" || status.status === "error") {
          throw new Error(`FFmpeg stitching failed: ${status.error || "unknown"}`);
        }
        return { url: "", done: false };
      });

      if (result.done) stitchedUrl = result.url;
      stitchAttempts++;
    }

    if (!stitchedUrl) throw new Error("Video stitching timed out");

    // 10. Download stitched video and upload to Supabase storage
    const storageKey = await step.run("store", async () => {
      const key = storageKeyFor("video", media.id);
      await downloadAndStore(db, stitchedUrl, key);
      return key;
    });

    // 11. Mark ready
    await step.run("finalize", () => markReady(db, media.id, storageKey));

    return { success: true, mediaId: media.id };
  }
);
