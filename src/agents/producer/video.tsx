import { NonRetriableError } from "inngest";
import type { SfxName } from "@video/presets";
import type { VideoBrief, VideoScene } from "@/core/creative/brief";
import { CARD_SCENES, STICKERS, STORYLINES } from "@/core/creative/video";
import { isVideoStyle } from "@/core/content/styles";
import { MODELS } from "@/config/models";
import { sfxUrls } from "@/config/sfx";
import { loadTheme } from "@/creative/theme";
import { buildTimeline, type BuildScene } from "@/creative/video/timeline";
import { linkText, momentLayout, priceText, timelineTheme, videoCanvas } from "@/creative/video/parts";
import { ai } from "@/providers/ai/registry";
import { getJob, submitRender } from "@/providers/ffmpeg/client";
import { finalName, mediaKey, publicUrl, ratioName, workKey } from "@/providers/storage/paths";
import { SCENE_LAYOUT_SYSTEM, sceneLayoutPrompt, sceneLayoutSchema } from "@/prompts/agents/scene-layout";
import type { FootageAnalysis } from "@/prompts/agents/footage";
import { logUsage } from "@/agents/weekly/task";
import { optional } from "@/agents/run";
import { plannedSeconds } from "@/agents/creative-director/checks-video";
import { pictureOnly } from "./picture-only";
import { canvasesFor } from "./canvases";
import { startJob, waitForJobs, type KieJob } from "./kie";
import { copyToStorage, markMediaReady, saveFile } from "./media";
import { photoPrompt, photoSettings } from "./photos";
import type { ProduceArgs, Produced } from "./types";
import { peoplePromptLine } from "@/core/content/prefs";

// Video, drawn by our Remotion renderer (worker/remotion/ad) from a timeline our code builds:
// 1. voice for each voiced scene (real word timings for captions)
// 2. pictures: the client's own video moments and photos are used as they are; AI makes only the
//    rest (a still, then a clip for moving scenes; card scenes keep a still), and a reveal's "after"
//    is made from its "before" so they match
// 3. everything is copied into our storage (AI links expire)
// 4. music in the client's mood (not for voice-only styles)
// 5. one vision call finds the subject and the calm area in each still, so words go beside it
// 6. a timeline per size (9:16, plus 4:5 for feed platforms) → rendered on the worker
// A QA redo makes only the failed AI scenes again and keeps everything else.

const CLIP_STYLE =
  "Cinematic, natural colour grade, smooth camera movement only, no cuts, photorealistic, keep the exact composition of the image. Nobody talks or moves their lips. No text, letters or logos.";
const MAX_RENDER_POLLS = 40;

/** A scene's picture once made: a key in our storage and how to play it */
export type MadePicture =
  | { kind: "clip"; key: string; start: number; end: number; keepAudio: boolean; still: string | null; layout: ReturnType<typeof momentLayout> | null; lines: { start: number; end: number; text: string }[] }
  | { kind: "photo"; key: string }
  | { kind: "ai-clip"; key: string; still: string; seconds: number }
  | { kind: "ai-still"; key: string };

/** What carries over between rounds, so a redo only remakes failed scenes. */
export interface VideoState {
  voices: ({ key: string; durationSec: number; words: { word: string; start: number; end: number }[] } | null)[];
  pictures: (MadePicture | null)[];
  reveals: (MadePicture | null)[];
  layouts: ({ subject: { x: number; y: number; w: number; h: number } | null; zone: "top" | "middle" | "bottom" | null; light: boolean | null } | null)[];
  musicKey: string | null;
}

const languageCode = (lang: string | null) => (lang && /^[a-z]{2}$/i.test(lang) ? lang.toLowerCase() : undefined);

/** Card scenes and photo slideshows don't need a moving AI clip: a still with a camera move is enough. */
function needsClip(scene: VideoScene, style: string | null): boolean {
  return !CARD_SCENES.includes(scene.kind) && style !== "slides";
}

/** The picture key behind a made scene, for looking at it (stills, photos; clips use their still). */
function stillOf(p: MadePicture | null): string | null {
  if (!p) return null;
  if (p.kind === "photo" || p.kind === "ai-still") return p.key;
  return p.still;
}

export async function produceVideo(a: ProduceArgs, brief: VideoBrief, previous: VideoState | null, redoScenes: number[] | null): Promise<{ produced: Produced; state: VideoState }> {
  const canvases = canvasesFor("video", a.item.platforms).map((c) => videoCanvas(c.ratio));
  const scope = { agent: "producer" as const, businessId: a.businessId, planId: a.item.plan_id, itemId: a.item.id, mediaId: a.mediaId };
  const onRetry = (usage: Parameters<typeof logUsage>[1]) => logUsage(scope, usage, "Made a scene again after a failed try");
  const scenes = brief.scenes;
  const redo = new Set(redoScenes ?? scenes.map((_, i) => i));
  const tag = `r${a.round}`;

  // 0. The client's real photos and video moments the brief picked
  const real = await a.task(
    `video-real-${a.round}`,
    async () => {
      const ids = [...new Set(scenes.flatMap((s) => [s.source, s.revealSource]).flatMap((src) => (src && src.kind !== "ai" ? [src.assetId] : [])))];
      const reference = brief.referenceAssetId;
      const { data, error } = await a
        .db()
        .from("brand_assets")
        .select("id, storage_key, analysis")
        .in("id", [...ids, ...(reference ? [reference] : [])]);
      if (error) throw error;
      return Object.fromEntries((data ?? []).map((r) => [r.id, { key: r.storage_key as string, analysis: r.analysis as FootageAnalysis | null }]));
    },
    (r) => `Found ${Object.keys(r).length} of your photos and videos for this video`
  );

  const fromSource = (src: VideoScene["source"] | null): MadePicture | null => {
    if (!src || src.kind === "ai") return null;
    const asset = real[src.assetId] as { key: string; analysis: FootageAnalysis | null } | undefined;
    if (!asset) return null;
    if (src.kind === "photo") return { kind: "photo", key: asset.key };
    const moment = asset.analysis?.moments.find((m) => Math.abs(m.start - src.start) < 0.5) ?? null;
    return {
      kind: "clip",
      key: asset.key,
      start: src.start,
      end: src.end,
      keepAudio: src.keepAudio,
      still: null,
      layout: moment ? momentLayout(moment) : null,
      lines: (moment?.lines ?? []).map((l) => ({ start: l.start - src.start, end: l.end - src.start, text: l.text })).filter((l) => l.end > 0 && l.start < src.end - src.start),
    };
  };

  // 1. Voice for each voiced scene: real spoken length and word timings
  const voices =
    previous?.voices ??
    (await a.task(
      `voice-${a.round}`,
      async (track) => {
        const { data: profile } = await a.db().from("business_profile").select("voice_id, language").single();
        const out: VideoState["voices"] = [];
        for (const [i, scene] of scenes.entries()) {
          if (!scene.voiceover.trim()) {
            out.push(null);
            continue;
          }
          const res = await ai.voice(scene.voiceover, profile?.voice_id ?? undefined, languageCode(profile?.language ?? null));
          track(res.usage);
          const key = workKey(a.businessId, a.mediaId, `voice-${i}.mp3`);
          await saveFile(a.db(), a.mediaId, "voice", key, res.data.buffer, "audio/mpeg", { position: i });
          out.push({ key, durationSec: res.data.durationSec, words: res.data.words });
        }
        return out;
      },
      (r) => {
        const voiced = r.filter(Boolean) as NonNullable<VideoState["voices"][number]>[];
        return voiced.length ? `Recorded the voice-over: ${voiced.length} scenes, ${Math.round(voiced.reduce((s, v) => s + v.durationSec, 0))} seconds` : "No voice-over in this video";
      }
    ));

  /** Seconds each scene lasts: its voice, its talking moment, or the brief's length */
  const seconds = scenes.map((s, i) => (voices[i] ? voices[i]!.durationSec + 0.35 : plannedSeconds(s)));

  // 2. AI pictures for scenes that have no real one (only the scenes being made this round)
  const aiScenes = scenes.map((s, i) => i).filter((i) => redo.has(i) && scenes[i].source.kind === "ai" && !(scenes[i].kind === "cta" && i > 0));
  const imageJobs = await a.task(
    `scene-images-${a.round}`,
    async (track) => {
      const settings = await photoSettings(a.db());
      const ref = brief.referenceAssetId && real[brief.referenceAssetId] ? publicUrl(real[brief.referenceAssetId].key) : null;
      const jobs: KieJob[] = [];
      for (const i of aiScenes) {
        const scene = scenes[i];
        // The real product anchors product-like scenes, so it looks like itself
        const useRef = ref && ["hook", "product", "detail", "result", "after", "benefit"].includes(scene.kind) ? ref : null;
        const res = await startJob({ key: `scene-${i + 1}`, kind: "image", prompt: photoPrompt(scene.visual, settings, !!useRef, a.fix), aspect: "9:16", refs: useRef ? [useRef] : [] });
        track(res.usage);
        jobs.push(res.job);
      }
      return jobs;
    },
    (r) => (r.length ? `Started ${r.length} scene pictures` : "Every scene uses your own photos and videos")
  );
  const images = imageJobs.length ? await waitForJobs(a.step, `scene-images-${a.round}`, imageJobs, { first: "25s", every: "15s", max: 20, onRetry }) : [];
  if (!images) throw new NonRetriableError("Making the scene pictures took too long. Try again.");

  // A reveal's "after", made from its "before" picture so the two match
  const revealJobs = await a.task(
    `reveal-images-${a.round}`,
    async (track) => {
      const settings = await photoSettings(a.db());
      const jobs: KieJob[] = [];
      for (const [i, scene] of scenes.entries()) {
        if (scene.kind !== "reveal" || !redo.has(i) || scene.revealSource?.kind !== "ai") continue;
        const before = images.find((j) => j.key === `scene-${i + 1}`)?.url ?? (fromSource(scene.source) ? publicUrl(stillOf(fromSource(scene.source)) ?? fromSource(scene.source)!.key) : null);
        const prompt = photoPrompt(`${scene.revealVisual || scene.visual}. The same place, framing and light as the reference image, now showing the result.`, settings, !!before, a.fix);
        const res = await startJob({ key: `reveal-${i + 1}`, kind: "image", prompt, aspect: "9:16", refs: before ? [before] : [] });
        track(res.usage);
        jobs.push(res.job);
      }
      return jobs;
    },
    (r) => (r.length ? `Started ${r.length} "after" pictures from their "before"` : "No reveal to make")
  );
  const revealImages = revealJobs.length ? await waitForJobs(a.step, `reveal-images-${a.round}`, revealJobs, { first: "25s", every: "15s", max: 20, onRetry }) : [];
  if (!revealImages) throw new NonRetriableError("Making the after pictures took too long. Try again.");

  // 3. Moving clips from the AI stills (card scenes and slideshows keep the still)
  const clipJobs = await a.task(
    `scene-clips-${a.round}`,
    async (track) => {
      const { people } = await photoSettings(a.db());
      const jobs: KieJob[] = [];
      for (const img of images) {
        const i = Number(img.key.split("-")[1]) - 1;
        if (!needsClip(scenes[i], brief.style)) continue;
        const duration = Math.min(15, Math.max(4, Math.ceil(seconds[i])));
        const prompt = [`${scenes[i].motion}.`, pictureOnly(scenes[i].visual), CLIP_STYLE, peoplePromptLine(people)].filter(Boolean).join(" ");
        const res = await startJob({ key: img.key, kind: "video", prompt, aspect: "9:16", refs: [], firstFrame: img.url, duration });
        track(res.usage);
        jobs.push(res.job);
      }
      return jobs;
    },
    (r) => (r.length ? `Started ${r.length} scene clips` : "No AI clips needed")
  );
  const clips = clipJobs.length ? await waitForJobs(a.step, `scene-clips-${a.round}`, clipJobs, { first: "45s", every: "30s", max: 25, onRetry }) : [];
  if (!clips) throw new NonRetriableError("Making the scene clips took too long. Try again.");

  // 4. Keep everything in our storage, and know each scene's picture
  const pictures = await a.task(
    `keep-scenes-${a.round}`,
    async () => {
      const made: { pictures: VideoState["pictures"]; reveals: VideoState["reveals"] } = {
        pictures: scenes.map((s, i) => (redo.has(i) ? fromSource(s.source) : (previous?.pictures[i] ?? fromSource(s.source)))),
        reveals: scenes.map((s, i) => (s.kind !== "reveal" ? null : redo.has(i) ? fromSource(s.revealSource) : (previous?.reveals[i] ?? fromSource(s.revealSource)))),
      };
      for (const img of images) {
        const i = Number(img.key.split("-")[1]) - 1;
        const still = workKey(a.businessId, a.mediaId, `scene-${i + 1}-${tag}.png`);
        await copyToStorage(img.url!, still);
        const clip = clips.find((c) => c.key === img.key);
        if (clip?.url) {
          const key = workKey(a.businessId, a.mediaId, `scene-${i + 1}-${tag}.mp4`);
          await copyToStorage(clip.url, key);
          made.pictures[i] = { kind: "ai-clip", key, still, seconds: clip.duration ?? 5 };
        } else made.pictures[i] = { kind: "ai-still", key: still };
      }
      for (const img of revealImages) {
        const i = Number(img.key.split("-")[1]) - 1;
        const key = workKey(a.businessId, a.mediaId, `reveal-${i + 1}-${tag}.png`);
        await copyToStorage(img.url!, key);
        made.reveals[i] = { kind: "ai-still", key };
      }
      // A closing card without its own picture sits on the hook's picture (calm, blurred); card
      // scenes without one use the brand's own product photo
      const productPhoto = brief.referenceAssetId && real[brief.referenceAssetId] ? ({ kind: "photo", key: real[brief.referenceAssetId].key } as const) : null;
      scenes.forEach((s, i) => {
        if (made.pictures[i]) return;
        made.pictures[i] = s.kind === "cta" ? made.pictures[0] : (productPhoto ?? made.pictures[i - 1] ?? made.pictures[0]);
      });
      return made;
    },
    () => "Saved the scenes"
  );

  // 5. Music in the client's mood (voice-only styles have none; the video works without it)
  let musicKey = previous?.musicKey ?? null;
  if (!previous && brief.sound !== "voice") {
    const total = seconds.reduce((s, x) => s + x, 0) + 1;
    musicKey = await optional(
      a.task(
        `music-${a.round}`,
        async (track) => {
          const quiet = brief.sound === "speech" ? " Quiet and unobtrusive: it plays under people talking." : "";
          const res = await ai.music(`${brief.musicMood}. Instrumental background music for a short social media ad, no vocals, steady energy.${quiet}`, Math.ceil(total));
          track(res.usage);
          const key = workKey(a.businessId, a.mediaId, "music.mp3");
          await saveFile(a.db(), a.mediaId, "music", key, res.data, "audio/mpeg");
          return key;
        },
        () => "Made the background music"
      )
    );
  }

  // 6. Where the subject and the calm area are in each still (words go beside the subject)
  const layouts = await a.task(
    `scene-look-${a.round}`,
    async (track) => {
      const out: VideoState["layouts"] = scenes.map((_, i) => (redo.has(i) ? null : (previous?.layouts[i] ?? null)));
      scenes.forEach((_, i) => {
        const p = pictures.pictures[i];
        if (p?.kind === "clip" && p.layout) out[i] = p.layout;
      });
      const toLook = scenes.map((_, i) => i).filter((i) => !out[i] && stillOf(pictures.pictures[i]));
      if (!toLook.length) return out;
      const res = await ai.structured(sceneLayoutSchema, sceneLayoutPrompt(toLook.length), {
        system: SCENE_LAYOUT_SYSTEM,
        images: toLook.map((i) => publicUrl(stillOf(pictures.pictures[i])!)),
        model: MODELS.vision,
      });
      track(res.usage);
      for (const s of res.data.scenes) {
        const i = toLook[s.image - 1];
        if (i !== undefined) out[i] = { subject: s.subject, zone: s.textZone, light: s.light };
      }
      return out;
    },
    (r) => `Found where the subject is in ${r.filter(Boolean).length} scenes`
  );

  // 7. The facts the cards show, the theme and the link
  const facts = await a.task(
    `video-facts-${a.round}`,
    async () => {
      const proofIds = scenes.flatMap((s) => (s.proofId ? [s.proofId] : []));
      const [proofs, offering, offer, profile, theme] = await Promise.all([
        proofIds.length ? a.db().from("proof_items").select("id, content, author, rating").in("id", proofIds) : Promise.resolve({ data: [] as { id: string; content: string; author: string | null; rating: number | null }[] }),
        a.item.offering_id ? a.db().from("offerings").select("price, currency, price_model").eq("id", a.item.offering_id).maybeSingle() : Promise.resolve({ data: null }),
        a.item.offer_id ? a.db().from("offers").select("title, details, ends_at").eq("id", a.item.offer_id).maybeSingle() : Promise.resolve({ data: null }),
        a.db().from("business_profile").select("website, cta_links").single(),
        loadTheme(a.db()),
      ]);
      const links: Record<string, string> = { website: profile.data?.website ?? "", ...(profile.data?.cta_links ?? {}) };
      const o = offering.data as { price: number | null; currency: string | null; price_model: string | null } | null;
      const f = offer.data as { title: string; details: string | null; ends_at: string | null } | null;
      return {
        proofs: Object.fromEntries((proofs.data ?? []).map((p) => [p.id, { text: p.content, author: p.author ?? "", rating: p.rating }])),
        price: o?.price != null ? priceText(Number(o.price), o.currency, o.price_model) : null,
        offer: f ? { title: f.title, detail: [f.details, f.ends_at && `Ends ${new Date(f.ends_at).toLocaleDateString("en", { day: "numeric", month: "short" })}`].filter(Boolean).join(" · ") } : null,
        link: linkText(links[brief.cta.link] || links.website),
        theme: timelineTheme(theme),
      };
    },
    () => "Gathered the facts, colours and fonts for the video"
  );

  // 8. One timeline per size, rendered on the worker
  const style = brief.style && isVideoStyle(brief.style) ? brief.style : "faceless";
  const sfx = sfxUrls() as Record<SfxName, string>;
  const toScene = (s: VideoScene, i: number): BuildScene => {
    const p = pictures.pictures[i]!;
    const voice = voices[i];
    const needed = seconds[i];
    const media =
      p.kind === "clip"
        ? { kind: "video" as const, url: publicUrl(p.key), trimStartSec: p.start, trimEndSec: p.end, volume: p.keepAudio ? 1 : 0, playbackRate: p.keepAudio ? 1 : Math.min(1, Math.max(0.7, (p.end - p.start) / needed)) }
        : p.kind === "ai-clip"
          ? { kind: "video" as const, url: publicUrl(p.key), trimStartSec: 0, trimEndSec: p.seconds, volume: 0, playbackRate: 1 }
          : { kind: "image" as const, url: publicUrl(p.key), motion: { fromScale: 1, toScale: 1, fromX: 0, toX: 0, fromY: 0, toY: 0 } };
    const r = pictures.reveals[i];
    return {
      kind: s.kind,
      media,
      reveal: r ? { kind: "image", url: publicUrl(stillOf(r) ?? r.key), motion: { fromScale: 1, toScale: 1, fromX: 0, toX: 0, fromY: 0, toY: 0 } } : null,
      layout: layouts[i] ?? { subject: null, zone: null, light: null },
      voice: voice ? { url: publicUrl(voice.key), durationSec: voice.durationSec, words: voice.words } : null,
      speech: p.kind === "clip" && p.keepAudio ? p.lines : null,
      seconds: voice ? null : needed,
      overlay: s.overlay,
      keywords: s.keywords,
      sticker: s.sticker ? STICKERS[s.sticker] : null,
      stat: s.stat ? { value: s.stat.value, decimals: s.stat.decimals, prefix: s.stat.prefix, suffix: s.stat.suffix, label: s.stat.label } : null,
      review: s.proofId ? (facts.proofs[s.proofId] ?? null) : null,
      price: s.showPrice ? facts.price : null,
      offer: s.kind === "offer" ? facts.offer : null,
      transition: s.transition,
    };
  };
  const built = scenes.map(toScene);

  const renders = await a.task(
    `video-render-${a.round}`,
    async () => {
      const jobs: { ratio: string; jobId: string; key: string; frames: number; starts: number[] }[] = [];
      for (const canvas of canvases) {
        const timeline = buildTimeline({
          canvas,
          preset: brief.preset as Parameters<typeof buildTimeline>[0]["preset"],
          theme: facts.theme,
          scenes: built,
          hook: brief.hook.text,
          cta: { label: brief.cta.label, line: brief.message.length <= 60 ? brief.message : "", link: facts.link },
          music: musicKey ? { url: publicUrl(musicKey) } : null,
          sfx,
          progressBar: STORYLINES[style].progressBar,
        });
        const key = mediaKey(a.businessId, a.mediaId, finalName(ratioName(canvas.ratio), a.round, "mp4"));
        const jobId = await submitRender("ad", timeline as unknown as Record<string, unknown>, key);
        jobs.push({ ratio: canvas.ratio, jobId, key, frames: timeline.durationInFrames, starts: timeline.scenes.map((s) => s.startFrame) });
      }
      return jobs;
    },
    (r) => `Sent ${r.length} ${r.length === 1 ? "size" : "sizes"} to the video renderer (${Math.round(r[0].frames / 30)} seconds)`
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

  const state: VideoState = { voices, pictures: pictures.pictures, reveals: pictures.reveals, layouts, musicKey };
  const produced = await a.task(
    `video-finish-${a.round}`,
    async () => {
      await a.db().from("media_files").delete().eq("media_id", a.mediaId).eq("role", "rendition");
      for (const r of renders.slice(1)) {
        await a.db().from("media_files").insert({ media_id: a.mediaId, role: "rendition", storage_key: r.key, aspect_ratio: r.ratio });
      }
      const durationSec = Math.round((renders[0].frames / 30) * 10) / 10;
      await a.db().from("media").update({ duration_sec: Math.round(durationSec) }).eq("id", a.mediaId);
      await markMediaReady(a.db(), a.mediaId, renders[0].key);
      const starts = renders[0].starts.map((f) => f / 30);
      return {
        mainKey: renders[0].key,
        previewUrls: renders.map((r) => publicUrl(r.key)),
        photoUrl: stillOf(pictures.pictures[0]) ? publicUrl(stillOf(pictures.pictures[0])!) : null,
        // Only AI pictures can have painted-in words
        sceneImageUrls: pictures.pictures.map((p) => (p && (p.kind === "ai-clip" || p.kind === "ai-still") ? publicUrl(stillOf(p)!) : null)),
        referenceUrl: null,
        contrast: [],
        canvases: renders.map((r) => {
          const c = videoCanvas(r.ratio as "9:16");
          return { ratio: r.ratio, width: c.width, height: c.height, key: r.key };
        }),
        durationSec,
        scenes: scenes.map((s, i) => ({ index: i, start: starts[i], end: starts[i + 1] ?? durationSec, visual: s.visual, voiceover: s.voiceover || s.overlay })),
      } satisfies Produced;
    },
    (r) => `Finished the video: ${r.durationSec} seconds in ${r.canvases.map((c) => c.ratio).join(" and ")}`
  );

  return { produced, state };
}
