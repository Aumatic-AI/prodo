import { NonRetriableError } from "inngest";
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import { directBrief, directContext, type DirectImage } from "@/agents/creative-director/direct-context";
import { loadCreativeContext } from "@/agents/creative-director/context";
import { studyReference } from "@/agents/creative-director/reference";
import { copyToStorage, markMediaReady, syncCost } from "@/agents/producer/media";
import type { Step } from "@/agents/producer/types";
import { LIMITS } from "@/config/limits";
import { platformMeta } from "@/config/platforms";
import { DIRECT_VIDEO } from "@/config/video-direct";
import { isVideoStyle } from "@/core/content/styles";
import { AppError } from "@/core/errors";
import { getItem, updateItem } from "@/core/plans/plans";
import { trace } from "@/lib/trace";
import type { PlanItem } from "@/core/plans/types";
import { loadTheme } from "@/creative/theme";
import { ai } from "@/providers/ai/registry";
import { request } from "@/providers/http";
import { getJob, renderBackend, submitJob } from "@/providers/ffmpeg/client";
import { finalName, mediaKey, publicUrl, ratioName, tmpKey, workKey } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";
import type { ReferenceVideo } from "@/prompts/agents/reference-video";
import { DIRECT_VIDEO_SYSTEM, directVideoPrompt, directVideoSchema } from "@/prompts/agents/video-direct";
import { logUsage, taskFor } from "./task";

// Direct video (config/video-direct.ts): two steps. OpenAI writes one detailed prompt from everything the business,
// the post and the owner's choices are; Seedance 2.5 on Kie makes the finished video from it in one go, with the
// real product photos (and the logo, when the owner wants it) as reference images. Its video is final: no scenes,
// no Remotion, no worker, no QA.

export async function produceDirectVideo(
  step: Step,
  db: () => SupabaseClient,
  scope: { businessId: string; planId: string; itemId: string; oneOff: boolean },
  settle: (status: "ready") => Promise<unknown>
): Promise<{ status: "ready" }> {
  const { businessId, planId, itemId, oneOff } = scope;
  const cd = taskFor(step, "creative_director", { businessId, planId, itemId });

  // "Copy a video": the reference is broken down scene by scene first (once)
  const referenceId = await step.run("direct-video-reference", async () => (await getItem(db(), itemId)).reference_video_id ?? null);
  if (referenceId) await studyReference(step, cd, db, businessId, referenceId);

  // 1. One prompt for the video model, written from the whole context
  const written = await cd(
    "direct-video-prompt",
    async (track) => {
      const { ctx, usage } = await loadCreativeContext(db(), itemId);
      if (usage) track(usage);
      const theme = await loadTheme(db());
      const logo = ctx.rules.showLogo ? (theme.logo.onLight ?? theme.logo.onDark ?? null) : null;
      // This product's own photos (a post about the brand, or a product without photos, gets a couple of the brand's)
      const own = ctx.offering ? ctx.assets.filter((a) => a.offeringId === ctx.offering!.id) : [];
      const photos = own.length ? own.slice(0, DIRECT_VIDEO.maxPhotos) : ctx.assets.slice(0, 2);
      const images: DirectImage[] = [
        ...photos.map((a) => ({
          url: publicUrl(a.storageKey),
          what: a.kind === "product_photo" && a.offeringName ? `real product photo of "${a.offeringName}"${a.description ? `: ${a.description}` : ""}` : `${a.kind.replace("_", " ")} photo${a.description ? `: ${a.description}` : ""}`,
        })),
        ...(logo ? [{ url: logo, what: "the brand's logo" }] : []),
      ];
      const colours = { primary: theme.primary.bg, accent: theme.accent.bg, heading: theme.fonts.heading, body: theme.fonts.body };
      const platforms = ctx.item.platforms.map((p) => ({ key: p, label: platformMeta(p).label, captionMax: platformMeta(p).captionMaxLength }));
      // The brand's recent videos, so this one is clearly different
      const { data: recentRows } = await db().from("plan_items").select("angle, brief").eq("format", "video").neq("id", itemId).order("created_at", { ascending: false }).limit(8);
      const recent = (recentRows ?? [])
        .map((r) => (r.brief as { videoConcept?: string } | null)?.videoConcept || (r.angle ?? "").split("\n")[0])
        .filter((t): t is string => !!t)
        .map((t) => t.replace(/\s+/g, " ").slice(0, 300));
      const res = await ai.structured(
        directVideoSchema,
        directVideoPrompt({
          context: directContext(ctx, colours, images),
          style: ctx.item.style && isVideoStyle(ctx.item.style) ? ctx.item.style : null,
          platforms,
          language: ctx.business.language,
          musicMood: ctx.rules.musicMood,
          logo: !!logo,
          reference: ctx.reference ? referenceText(ctx.reference) : null,
          recent,
        }),
        { system: DIRECT_VIDEO_SYSTEM, images: photos.map((a) => publicUrl(a.storageKey)) }
      );
      track(res.usage);
      const v = res.data;

      // The post's brief for the app (title, hook, call to action, post text), keeping the full video prompt
      const base = directBrief(ctx, photos[0]?.id ?? null);
      const captions = Object.fromEntries(platforms.map((p) => [p.key, (v.captions[p.key] || base.captions[p.key] || v.message).slice(0, p.captionMax)]));
      const brief = {
        ...base,
        message: v.message,
        hook: { ...base.hook, text: v.hook },
        headline: v.title.slice(0, 80),
        cta: { ...base.cta, label: v.ctaLabel },
        captions,
        videoPrompt: v.videoPrompt,
        videoConcept: v.concept,
        videoAlternatives: v.alternatives,
        durationSec: v.durationSec,
      };
      await updateItem(db(), itemId, { brief, captions, hook_text: v.hook, status: "briefed", error: null });
      return { brief, prompt: v.videoPrompt, durationSec: v.durationSec, refs: images.map((i) => i.url), logo: !!logo };
    },
    (r) => `Wrote the video prompt: ${r.durationSec} seconds, ${r.prompt.length} characters, ${r.refs.length} reference image${r.refs.length === 1 ? "" : "s"}${r.logo ? " (with the logo)" : ""}`
  );

  const item = (await step.run("load-item", () => getItem(db(), itemId))) as PlanItem;
  const mediaId = await step.run("start-media", async () => {
    const { data, error } = await db()
      .from("media")
      .insert({
        type: "video",
        source: "generated",
        status: "generating",
        idea: written.brief.message,
        aspect_ratio: DIRECT_VIDEO.aspectRatio,
        use_logo: written.logo,
        plan_item_id: itemId,
        offering_id: item.offering_id,
        creative_spec: written.brief,
      })
      .select("id")
      .single();
    if (error) throw error;
    await updateItem(db(), itemId, { selected_media_id: data.id, status: "producing" });
    return data.id as string;
  });
  const producer = taskFor(step, "producer", { businessId, planId, itemId, mediaId });

  // 2. Copy a video: the reference's own sound track (up to 30 s), cut out by our worker, for Seedance to use as the music
  const audioUrl = referenceId ? await referenceAudio(step, db, businessId, referenceId) : null;

  // 3. One request to Seedance 2.5: the prompt, the reference images and, when there is one, the reference's music.
  // Seedance checks the sound it made only at the end; when it blocks the reference's music for copyright, the video
  // is made once more with new original music (a failed job uses no credits, only time).
  const start = (key: string, withAudio: boolean) =>
    producer(
      key,
      async () => {
        const refs: string[] = [];
        for (const [i, url] of written.refs.entries()) refs.push(await fitReference(url, workKey(businessId, mediaId, `ref-${i + 1}.jpg`)));
        const prompt = withAudio
          ? `${written.prompt}\n\nMUSIC: the attached reference audio is this video's music. Use it as it is, from its start, and cut on its beats; it replaces any music described above. Voices and sound effects stay as described.`
          : written.prompt;
        const res = await ai.videoFull(prompt, {
          referenceImageUrls: refs,
          referenceAudioUrls: withAudio && audioUrl ? [audioUrl] : [],
          durationSec: written.durationSec,
          aspectRatio: DIRECT_VIDEO.aspectRatio,
          resolution: DIRECT_VIDEO.resolution,
        });
        // The cost is logged once the video is made: a failed job is free
        return { taskId: res.data, usage: res.usage, refs: refs.length, withAudio };
      },
      (r) => `Sent the prompt and ${r.refs} reference image${r.refs === 1 ? "" : "s"}${r.withAudio ? " and the reference's music" : ""} to Seedance 2.5 (${written.durationSec} seconds, ${DIRECT_VIDEO.resolution})`
    );

  let started = await start("direct-video-start", !!audioUrl);
  let made = await waitForVideo(step, planId, "direct-video", started.taskId);
  if ("fail" in made && started.withAudio && /copyright/i.test(made.fail)) {
    started = await start("direct-video-start-new-music", false);
    made = await waitForVideo(step, planId, "direct-video-again", started.taskId);
  }
  if ("fail" in made) throw new NonRetriableError(made.fail);
  const videoUrl = made.url;
  await step.run("direct-video-cost", () => logUsage({ agent: "producer", businessId, planId, itemId, mediaId }, started.usage, started.withAudio ? "Seedance 2.5 made the video with the reference's music" : "Seedance 2.5 made the video"));

  // 3. Its video is the final post
  await producer(
    "direct-video-keep",
    async () => {
      const key = mediaKey(businessId, mediaId, finalName(ratioName(DIRECT_VIDEO.aspectRatio), 0, "mp4"));
      await copyToStorage(videoUrl, key);
      await markMediaReady(db(), mediaId, key);
      return key;
    },
    () => "Saved the finished video"
  );

  await step.run("sync-cost", () => syncCost(db(), mediaId));
  await settle("ready");
  await step.sendEvent("settled", { name: "plan-item/settled", data: { businessId, itemId, planId, oneOff } });
  return { status: "ready" };
}

/** Waits for the Seedance job: first after 90 s, then every 30 s, up to 20 minutes. A failure comes back as its message. */
async function waitForVideo(step: Step, planId: string, prefix: string, taskId: string): Promise<{ url: string } | { fail: string }> {
  for (let i = 0; i < 40; i++) {
    await step.sleep(`${prefix}-wait-${i}`, i ? "30s" : "90s");
    const id = `${prefix}-poll-${i}`;
    // Traced with the plan's run, so the trace log shows Seedance's answers next to the request
    const result = await step.run(id, () =>
      trace.scope({ runId: planId, agent: "producer", step: id }, async (): Promise<{ url: string } | { fail: string } | null> => {
        const status = await ai.image.status(taskId);
        if (status.state === "success") return { url: ai.task.resultUrl(status) };
        if (status.state === "fail") return { fail: ai.task.error(status, "video").message };
        return null;
      })
    );
    if (result) return result;
  }
  return { fail: "Seedance didn't finish the video within 20 minutes. Try again." };
}

/** The reference video's sound track, up to 30 s, as a WAV cut out by our worker; null without the worker or a track of 2 s or more. */
async function referenceAudio(step: Step, db: () => SupabaseClient, businessId: string, assetId: string): Promise<string | null> {
  const job = await step.run("direct-video-audio", async () => {
    if (renderBackend().id !== "worker") return null;
    const { data } = await db().from("brand_assets").select("storage_key, analysis").eq("id", assetId).maybeSingle();
    const duration = Number((data?.analysis as { duration?: number } | null)?.duration ?? 0);
    if (!data?.storage_key || duration < 2) return null;
    const key = tmpKey(`${businessId}/reference/${assetId}/audio.wav`);
    try {
      const id = await submitJob({
        inputs: [data.storage_key],
        args: ["-i", "{input0}", "-vn", "-t", "30", "-ac", "2", "-ar", "44100", "-c:a", "pcm_s16le", "-f", "wav", "{output}"],
        outputKey: key,
        contentType: "audio/wav",
      });
      return { id, key };
    } catch {
      return null;
    }
  });
  if (!job) return null;
  for (let i = 0; i < 12; i++) {
    await step.sleep(`direct-video-audio-wait-${i}`, "5s");
    const status = await step.run(`direct-video-audio-poll-${i}`, () => getJob(job.id).then((r) => r.status).catch(() => "failed" as const));
    if (status === "done") return publicUrl(job.key);
    if (status === "failed") return null;
  }
  return null;
}

/** Seedance takes images 300–6000 px a side and 0.4–2.5 wide to tall: each reference is redrawn to fit and kept in our storage. */
async function fitReference(url: string, key: string): Promise<string> {
  const res = await request("File storage", url, {}, LIMITS.downloadTimeoutMs);
  if (!res.ok) throw new AppError(`Couldn't read a reference image for the video (status ${res.status}).`, "PROVIDER_DOWN", true);
  const source = sharp(Buffer.from(await res.arrayBuffer())).rotate();
  const { width = 1, height = 1 } = await source.metadata();
  const ratio = width / height;
  const fitted = ratio < 0.45 || ratio > 2.2 ? source.resize(1280, 1280, { fit: "contain", background: "#ffffff" }) : source.resize(1280, 1280, { fit: "inside" });
  const jpg = await fitted.flatten({ background: "#ffffff" }).jpeg({ quality: 90 }).toBuffer();
  await upload(key, jpg, "image/jpeg");
  return publicUrl(key);
}

/** The reference video's breakdown as plain lines for the prompt writer. */
function referenceText(r: ReferenceVideo): string {
  return [
    `${Math.round(r.duration)} seconds. ${r.summary}`,
    r.format && `Format: ${r.format}`,
    r.pacing && `Pacing: ${r.pacing}`,
    r.look && `Look: ${r.look}`,
    `Sound: voice ${r.sound.voice || "none"}; music ${r.sound.music || "none"}; effects ${r.sound.effects || "none"}`,
    r.captions && `Captions: ${r.captions}`,
    r.ending && `Ending: ${r.ending}`,
    ...r.scenes.map((s, i) => {
      const text = s.onScreenText ? `on screen "${s.onScreenText}"${s.textPosition || s.textStyle ? ` (${[s.textPosition, s.textStyle].filter(Boolean).join(", ")})` : ""}` : "";
      return `${i + 1}. ${s.start.toFixed(1)}–${s.end.toFixed(1)} s: ${[s.shows, s.shot, s.camera && `camera ${s.camera}`, s.people && `people ${s.people}`, s.action, text, s.spoken && `said "${s.spoken}"`, s.transition && `then ${s.transition}`].filter(Boolean).join(" · ")}`;
    }),
  ]
    .filter(Boolean)
    .join("\n");
}
