import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import type { Step } from "@/agents/producer/types";
import type { Task } from "@/agents/weekly/task";
import { LIMITS } from "@/config/limits";
import { MODELS } from "@/config/models";
import type { VideoSound } from "@/core/content/styles";
import { AppError } from "@/core/errors";
import { ai } from "@/providers/ai/registry";
import { getJob, renderBackend, submitJob } from "@/providers/ffmpeg/client";
import { request } from "@/providers/http";
import { publicUrl, tmpKey } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";
import {
  REFERENCE_VIDEO_JSON_SCHEMA,
  mergeReference,
  referenceShotsPrompt,
  referenceShotsSchema,
  referenceVideoPrompt,
  referenceVideoSchema,
  type ReferenceShots,
  type ReferenceVideo,
} from "@/prompts/agents/reference-video";

// A reference video the owner gave for one post ("make this video for my product"), read once and kept on its
// reference_videos row, so "Make again" reuses it and the breakdown stays after the file is gone (storage deletes
// it after 7 days). Two readings, each trusted for what it does best: Twelve Labs
// watches and listens (the summary, pacing and all the sound: voice, every spoken line, music, effects); our
// worker takes timed frames and one vision call writes the exact cut list, words on screen and look. Code merges
// them into one breakdown (mergeReference), so the prompt writer never sees two versions of the same thing.

/** Frames per video at most, and the shortest gap between them (seconds) */
const MAX_FRAMES = 48;
const MIN_GAP = 0.5;
/** Frames on one contact sheet (4 across) */
const PER_SHEET = 16;

/** The saved breakdown of a reference video, or null when it hasn't been read yet. */
export async function loadReference(db: SupabaseClient, assetId: string): Promise<ReferenceVideo | null> {
  const { data, error } = await db.from("reference_videos").select("analysis").eq("id", assetId).maybeSingle();
  if (error) throw error;
  const parsed = referenceVideoSchema.safeParse(data?.analysis);
  return parsed.success && parsed.data.scenes.length ? parsed.data : null;
}

/** Reads the reference video (once) before the prompt is written. */
export async function studyReference(step: Step, task: Task, db: () => SupabaseClient, businessId: string, assetId: string): Promise<void> {
  // 1. Twelve Labs watches and listens; it also gives the length
  const heard = await task(
    "study-reference",
    async (track) => {
      const known = await loadReference(db(), assetId);
      if (known) return { known: true, key: "", breakdown: known };
      const { data, error } = await db().from("reference_videos").select("storage_key").eq("id", assetId).single();
      if (error) throw error;
      if (!data.storage_key) throw new AppError("The reference video's file is gone. Add the video again.", "INVALID_INPUT", false);
      const res = await ai.analyzeVideo(publicUrl(data.storage_key), referenceVideoPrompt(), REFERENCE_VIDEO_JSON_SCHEMA);
      track(res.usage);
      const breakdown = referenceVideoSchema.parse(res.data);
      if (!breakdown.duration) throw new AppError("Twelve Labs couldn't read the reference video. Try another video.", "INVALID_INPUT", false);
      return { known: false, key: data.storage_key as string, breakdown };
    },
    (r) => (r.known ? "The reference video was already read" : `Watched and listened to the reference video: ${Math.round(r.breakdown.duration)} seconds, ${r.breakdown.speech.length} spoken lines`)
  );
  if (heard.known) return;

  const duration = heard.breakdown.duration;
  const gap = Math.max(MIN_GAP, Math.round((duration / MAX_FRAMES) * 10) / 10);
  const times = Array.from({ length: Math.floor(duration / gap) + 1 }, (_, i) => Math.round(i * gap * 100) / 100).filter((t) => t < duration - 0.05);

  // 2. Our worker takes a frame at each time (a job each; without the worker, the Twelve Labs scenes are used)
  const jobs = await task(
    "reference-frames",
    async () => {
      // Only our own worker: the paid fallback service would charge for every frame
      if (renderBackend().id !== "worker") return [];
      try {
        const out: { t: number; key: string; id: string }[] = [];
        for (const t of times) {
          const key = tmpKey(`${businessId}/reference/${assetId}/f-${t.toFixed(2)}.jpg`);
          const id = await submitJob({ inputs: [heard.key], args: ["-ss", t.toFixed(2), "-i", "{input0}", "-frames:v", "1", "-q:v", "4", "-f", "image2", "{output}"], outputKey: key, contentType: "image/jpeg" });
          out.push({ t, key, id });
        }
        return out;
      } catch {
        return [];
      }
    },
    (r) => (r.length ? `Asked the video worker for ${r.length} frames, one every ${gap} seconds` : "No frames: the video worker isn't answering, so the scenes come from Twelve Labs alone")
  );

  let frames: { t: number; key: string }[] = [];
  for (let i = 0; jobs.length && i < 30; i++) {
    await step.sleep(`reference-frames-wait-${i}`, i ? "5s" : "10s");
    const state = await step.run(`reference-frames-poll-${i}`, async () => {
      const states = await Promise.all(jobs.map((j) => getJob(j.id).then((s) => s.status).catch(() => "failed" as const)));
      return { busy: states.some((s) => s === "queued" || s === "running"), done: jobs.filter((_, k) => states[k] === "done").map(({ t, key }) => ({ t, key })) };
    });
    frames = state.done;
    if (!state.busy) break;
  }

  // 3. One vision call reads the timed frames; code merges both readings and saves them
  await task(
    "reference-scenes",
    async (track) => {
      let seen: ReferenceShots | null = null;
      if (frames.length >= 4) {
        const sheets = await contactSheets(frames, (n) => tmpKey(`${businessId}/reference/${assetId}/sheet-${n}.jpg`));
        const res = await ai.structured(referenceShotsSchema, referenceShotsPrompt(Math.round(duration * 10) / 10, gap, sheets.length), { images: sheets, model: MODELS.vision });
        track(res.usage);
        seen = res.data;
      }
      const breakdown = mergeReference(heard.breakdown, seen);
      if (!breakdown.scenes.length) throw new AppError("The reference video couldn't be split into scenes. Try another video.", "INVALID_INPUT", false);
      const { error } = await db()
        .from("reference_videos")
        .update({ analysis: breakdown, summary: breakdown.summary || null, duration_sec: breakdown.duration || null, analyzed_at: new Date().toISOString() })
        .eq("id", assetId);
      if (error) throw error;
      return { scenes: breakdown.scenes.length, fromFrames: !!seen };
    },
    (r) => `Broke the reference video into ${r.scenes} scenes (${r.fromFrames ? "shots from the frames, sound and speech from Twelve Labs" : "from Twelve Labs alone"})`
  );
}

/** Frames laid out 4 across with their times, 16 to a sheet, so one vision call sees the whole video in order. */
async function contactSheets(frames: { t: number; key: string }[], keyFor: (n: number) => string): Promise<string[]> {
  const W = 270;
  const H = 480;
  const COLS = 4;
  const urls: string[] = [];
  for (let s = 0; s * PER_SHEET < frames.length; s++) {
    const part = frames.slice(s * PER_SHEET, (s + 1) * PER_SHEET);
    const tiles = await Promise.all(
      part.map(async (f, i) => {
        const res = await request("File storage", publicUrl(f.key), {}, LIMITS.downloadTimeoutMs);
        if (!res.ok) throw new AppError(`Couldn't read a frame of the reference video (status ${res.status}).`, "PROVIDER_DOWN", true);
        const label = Buffer.from(`<svg width="${W}" height="34"><rect width="${W}" height="34" fill="black" opacity="0.75"/><text x="8" y="24" font-size="22" font-family="Arial" fill="white">${f.t.toFixed(1)}s</text></svg>`);
        const input = await sharp(Buffer.from(await res.arrayBuffer()))
          .resize(W, H, { fit: "contain", background: "#000000" })
          .composite([{ input: label, top: 0, left: 0 }])
          .toBuffer();
        return { input, left: (i % COLS) * W, top: Math.floor(i / COLS) * H };
      })
    );
    const jpg = await sharp({ create: { width: W * COLS, height: H * Math.ceil(part.length / COLS), channels: 3, background: "#000000" } })
      .composite(tiles)
      .jpeg({ quality: 80 })
      .toBuffer();
    const key = keyFor(s + 1);
    await upload(key, jpg, "image/jpeg");
    urls.push(publicUrl(key));
  }
  return urls;
}

const said = (s: string) => !!s.trim() && !/^(none|no\b|nobody|n\/a|-)/i.test(s.trim());

/** How the video sounds when it follows a reference: the reference's own voice and music. */
export function referenceSound(r: ReferenceVideo, talkingFootage: boolean): VideoSound {
  if (!said(r.sound.voice)) return "music";
  if (talkingFootage && /camera|on screen|on-screen/i.test(r.sound.voice)) return "speech";
  return said(r.sound.music) ? "voice_music" : "voice";
}
