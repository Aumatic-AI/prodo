import { inngest } from "@/jobs/client";
import type { Brief } from "@/core/creative/brief";
import { getItem, updateItem } from "@/core/plans/plans";
import type { PlanItem, QaReport } from "@/core/plans/types";
import { businessDb } from "@/lib/supabase/business";
import { writeBrief } from "@/agents/creative-director";
import { gate1 } from "@/agents/qa-critic/gate1";
import { gate2, type Gate2Result } from "@/agents/qa-critic/gate2";
import { produceCarousel } from "@/agents/producer/carousel";
import { startMedia, syncCost } from "@/agents/producer/media";
import { produceStatic } from "@/agents/producer/static";
import { produceStaticFree } from "@/agents/producer/static-free";
import { isDirectImageAd, isFreeImageAd } from "@/config/image-ads";
import { videoQaEnabled } from "@/config/video-qa";
import { produceDirect } from "./produce-direct";
import { produceDirectVideo } from "./produce-video-direct";
import { isDirectVideo } from "@/config/video-direct";
import { studyReference } from "@/agents/creative-director/reference";
import type { ProduceArgs, Produced } from "@/agents/producer/types";
import { produceVideo, type VideoState } from "@/agents/producer/video";
import { taskFor } from "./task";
import { optional } from "@/agents/run";
import { assertVideoReady } from "@/providers/ffmpeg/client";
import { failureMessage, toInngestError } from "@/jobs/to-inngest-error";

// One slot, start to finish:
// Creative Director → QA Gate 1 (below 7 goes back, at most two redos) → Producer → QA Gate 2
// (only the failed photo or scenes are made again, at most twice) → ready for the client, or
// "Needs review" with the reason. Money is only spent once the brief passes Gate 1.

export const MAX_REDOS = 2;

export const produceItem = inngest.createFunction(
  {
    id: "produce-plan-item",
    retries: 2,
    concurrency: [{ limit: 3, key: "event.data.businessId" }],
    cancelOn: [{ event: "plan-item/cancelled", if: "event.data.itemId == async.data.itemId && event.data.businessId == async.data.businessId" }],
    onFailure: async ({ event, error }) => {
      const { businessId, itemId, planId, oneOff } = event.data.event.data;
      const db = businessDb(businessId);
      const message = failureMessage(error);
      await db.from("plan_items").update({ status: "failed", error: message }).eq("id", itemId);
      await db.from("media").update({ status: "failed", error: message }).eq("plan_item_id", itemId).eq("status", "generating");
      await inngest.send({ name: "plan-item/settled", data: { businessId, itemId, planId, oneOff } });
    },
  },
  { event: "plan-item/produce" },
  async ({ event, step }) => {
    const { businessId, itemId, planId, note = null, oneOff = false } = event.data;
    const db = () => businessDb(businessId);
    const cd = taskFor(step, "creative_director", { businessId, planId, itemId });
    const qa = taskFor(step, "qa_critic", { businessId, planId, itemId });

    const settle = (status: "ready" | "needs_review", report?: Partial<QaReport>) =>
      step.run(`settle-${status}`, async () => {
        const item = await getItem(db(), itemId);
        await updateItem(db(), itemId, { status, qa_report: { ...(item.qa_report ?? {}), ...report } });
      });

    // Videos need our renderer: check it before the brief, so nothing is spent on a video that can't be made
    const format = await step.run("check-video-setup", async () => {
      const item = await getItem(db(), itemId);
      if (item.format === "video") await assertVideoReady().catch(toInngestError);
      return item.format;
    });

    // Direct video: one written prompt, one Seedance video, final (config/video-direct.ts)
    if (isDirectVideo(format)) return produceDirectVideo(step, db, { businessId, planId, itemId, oneOff }, settle);

    // The "direct" test mode: no Creative Director and no QA; the image model gets everything and its picture is final
    if (isDirectImageAd(format)) {
      const res = await produceDirect(step, db, { businessId, planId, itemId, oneOff }, settle);
      return res;
    }

    // A reference video for this post is broken down scene by scene (once) before the brief
    const referenceId = format === "video" ? await step.run("reference-video", async () => (await getItem(db(), itemId)).reference_video_id ?? null) : null;
    if (referenceId) await studyReference(step, cd, db, businessId, referenceId);

    // ---------- Brief and Gate 1 ----------
    let brief: Brief | null = null;
    let feedback: string[] | null = null;
    let passedGate1 = false;
    let lastScore = 0;
    for (let round = 0; round <= MAX_REDOS && !passedGate1; round++) {
      const written = await writeBrief(cd, db, itemId, round, feedback, note);
      brief = written.brief;
      const g1 = await gate1(qa, db, itemId, round, written.brief, written.problems);
      passedGate1 = g1.passed;
      lastScore = g1.score;
      feedback = g1.fixes;
      if (!passedGate1 && round < MAX_REDOS) await step.run(`count-redo-${round}`, () => updateItem(db(), itemId, { attempts: round + 1 }));
    }
    // The brief never passed: it is still made (the client asked for a post), and the post waits for the client with the reason
    const gate1Reason = passedGate1 ? null : `The brief scored ${lastScore}/10 after ${MAX_REDOS} rewrites (${feedback?.[0] ?? "below the bar"}). It was made anyway; look it over before approving.`;
    if (!brief) {
      await settle("needs_review", { reason: `The brief scored ${lastScore}/10 after ${MAX_REDOS} rewrites. Main issue: ${feedback?.[0] ?? "below the bar"}. Nothing was spent on images or video.` });
      await step.sendEvent("settled", { name: "plan-item/settled", data: { businessId, itemId, planId, oneOff } });
      return { status: "needs_review" };
    }

    // ---------- Produce ----------
    const item = (await step.run("load-item", () => getItem(db(), itemId))) as PlanItem;
    const mediaId = await step.run("start-media", async () => {
      // Earlier attempts for this slot stay in the library but no longer count as its media
      const ratio = brief!.kind === "video" ? "9:16" : brief!.kind === "carousel" ? "4:5" : "4:5";
      const id = await startMedia(db(), item, brief!, ratio);
      await updateItem(db(), itemId, { selected_media_id: id });
      return id;
    });

    // A text post is ready as soon as its brief passes (startMedia saved it as ready)
    if (brief.kind === "text") {
      await settle("ready");
      await step.sendEvent("settled", { name: "plan-item/settled", data: { businessId, itemId, planId, oneOff } });
      return { status: "ready" };
    }

    const producer = taskFor(step, "producer", { businessId, planId, itemId, mediaId });
    const qa2 = taskFor(step, "qa_critic", { businessId, planId, itemId, mediaId });
    let videoState: VideoState | null = null;
    let fix: string | null = null;
    let redoScenes: number[] | null = null;
    let review: Gate2Result | null = null;
    // For now a video is final once it is put together: no watching, no score, no remaking (config/video-qa.ts)
    const checkAsset = brief.kind !== "video" || videoQaEnabled();

    for (let round = 0; round <= MAX_REDOS; round++) {
      const args: ProduceArgs = { step, businessId, task: producer, db, item, mediaId, round, fix };
      let produced: Produced;
      if (brief.kind === "static") produced = isFreeImageAd("static") ? await produceStaticFree(args, brief) : await produceStatic(args, brief);
      else if (brief.kind === "carousel") produced = await produceCarousel(args, brief);
      else {
        const res = await produceVideo(args, brief, videoState, round ? redoScenes : null);
        produced = res.produced;
        videoState = res.state as VideoState;
      }
      if (!checkAsset) break;
      // A check that keeps failing for technical reasons (after its retries) never fails the post
      review =
        (await optional(gate2(qa2, db, itemId, round, brief, produced), { anyError: true })) ??
        ({ passed: false, score: 0, checks: [], notes: "", fix: null, redoScenes: [], unavailable: "the checking service didn't answer" } satisfies Gate2Result);
      // The asset is finished but couldn't be checked: don't remake it, let the client look
      if (review.passed || review.unavailable) break;
      fix = review.fix;
      // Only the scenes QA flagged; when it flagged none (e.g. the overall score), all of them
      redoScenes = review.redoScenes.length ? review.redoScenes : null;
      if (round < MAX_REDOS) await step.run(`count-asset-redo-${round}`, () => updateItem(db(), itemId, { attempts: Math.min(3, round + 1) }));
    }

    await step.run("sync-cost", () => syncCost(db(), mediaId));
    if (gate1Reason) await settle("needs_review", { reason: gate1Reason });
    else if (!checkAsset || review?.passed) await settle("ready");
    else if (review?.unavailable) {
      await settle("needs_review", { reason: `The finished ${brief.kind === "video" ? "video" : "design"} couldn't get its final quality check (${review.unavailable}). Look it over, or choose Try again.` });
    } else {
      const failed = review?.checks.filter((c) => !c.passed).map((c) => c.detail ?? c.name) ?? [];
      await settle("needs_review", {
        reason: `Still below the bar after ${MAX_REDOS} redos (${review?.score ?? 0}/10). ${failed.slice(0, 2).join(" ") || review?.notes || ""}`.trim(),
      });
    }
    await step.sendEvent("settled", { name: "plan-item/settled", data: { businessId, itemId, planId, oneOff } });
    return { status: !gate1Reason && (!checkAsset || review?.passed) ? "ready" : "needs_review" };
  }
);
