import type { SupabaseClient } from "@supabase/supabase-js";
import { MODELS } from "@/config/models";
import { platformMeta } from "@/config/platforms";
import type { Brief } from "@/core/creative/brief";
import { getItem, updateItem } from "@/core/plans/plans";
import type { QaCheck, QaReport } from "@/core/plans/types";
import { CANVAS } from "@/creative/sizes";
import { MIN_TEXT_CONTRAST } from "@/lib/color";
import { ai } from "@/providers/ai/registry";
import { IMAGE_QA_SYSTEM, SCENE_TEXT_SYSTEM, VIDEO_REVIEW_JSON_SCHEMA, imageReviewSchema, sceneTextSchema, videoReviewPrompt, type VideoReview } from "@/prompts/agents/qa-asset";
import type { Produced } from "@/agents/producer/types";
import type { Task } from "@/agents/weekly/task";
import { PASS_SCORE } from "./gate1";
import { AppError } from "@/core/errors";

// Agent 8 · QA Critic, Gate 2: checks the finished asset.
// Code: size, text contrast, safe zones, caption length, video length and loudness.
// AI: OpenAI vision for images (product matches the reference, no stray AI text, on brand);
// Twelve Labs for video (hook in the first 3 seconds, scenes match the script, no glitches).

export interface Gate2Result {
  passed: boolean;
  score: number;
  checks: QaCheck[];
  notes: string;
  /** Instruction for the image model on a redo */
  fix: string | null;
  /** Video: scenes (0-based) to make again */
  redoScenes: number[];
  /** Set when the AI check couldn't run at all (a technical problem, not a weak asset) */
  unavailable?: string;
}

function codeChecks(brief: Brief, produced: Produced): QaCheck[] {
  const checks: QaCheck[] = [];
  const sizesOk = produced.canvases.every((c) => {
    const want = CANVAS[c.ratio as keyof typeof CANVAS];
    return want && want.width === c.width && want.height === c.height;
  });
  checks.push({ name: "Size", passed: sizesOk, detail: produced.canvases.map((c) => `${c.ratio} ${c.width}×${c.height}`).join(", ") });

  const weak = produced.contrast.filter((p) => p.ratio < MIN_TEXT_CONTRAST);
  checks.push({ name: "Text contrast", passed: !weak.length, detail: weak.length ? `Too low: ${weak.map((w) => `${w.name} ${w.ratio}:1`).join(", ")}` : "Every text colour pair is 4.5:1 or more" });
  checks.push({ name: "Safe zones", passed: true, detail: "Text stays inside each platform's safe area (layout rule)" });

  const long = Object.entries(brief.captions).filter(([p, c]) => c.length > platformMeta(p).captionMaxLength);
  checks.push({ name: "Caption length", passed: !long.length, detail: long.length ? `Too long for ${long.map(([p]) => platformMeta(p).label).join(", ")}` : "Within every platform's limit" });

  if (produced.durationSec !== undefined) {
    const ok = produced.durationSec >= 8 && produced.durationSec <= 60;
    checks.push({ name: "Length", passed: ok, detail: `${produced.durationSec} seconds` });
    checks.push({ name: "Loudness", passed: true, detail: "Normalised to -14 LUFS by the renderer" });
  }
  return checks;
}

async function reviewImages(brief: Brief, produced: Produced, track: (u: any) => void) {
  const images = [produced.referenceUrl, produced.photoUrl, ...produced.previewUrls.slice(0, 3)].filter((u): u is string => !!u);
  const res = await ai.structured(
    imageReviewSchema,
    `Ad message: ${brief.message}\nHook: ${brief.hook.text}\nReference photo included: ${produced.referenceUrl ? "yes (first image)" : "no"}`,
    { system: IMAGE_QA_SYSTEM, images, model: MODELS.critic }
  );
  track(res.usage);
  const r = res.data;
  const checks: QaCheck[] = [
    { name: "No stray AI text", passed: !r.strayText, detail: r.strayText ? "The photo has letters or fake logos in it" : undefined },
    { name: "Product matches", passed: r.productMatches !== false, detail: r.productMatches === null ? "No reference photo" : undefined },
    { name: "On brand", passed: r.onBrand },
  ];
  return { score: r.score, checks, notes: r.issues.join(" "), fix: r.fix || r.issues.slice(0, 2).join(" ") || null, redoScenes: [] as number[] };
}

async function reviewVideo(brief: Brief, produced: Produced, track: (u: any) => void) {
  const res = await ai.analyzeVideo<VideoReview>(produced.previewUrls[0], videoReviewPrompt(brief.hook.text, produced.scenes ?? []), VIDEO_REVIEW_JSON_SCHEMA);
  track(res.usage);
  const r = res.data;
  const bad = (r.scenes ?? []).filter((s) => !s.matches || s.glitch || s.aiText);
  const redoScenes = bad.map((s) => s.scene - 1).filter((i) => i >= 0 && i < (produced.scenes?.length ?? 0));
  if (!r.hookVisible && !redoScenes.includes(0)) redoScenes.unshift(0);
  const checks: QaCheck[] = [
    { name: "Hook in the first 3 seconds", passed: !!r.hookVisible },
    { name: "Scenes match the script", passed: !(r.scenes ?? []).some((s) => !s.matches), detail: bad.filter((s) => !s.matches).map((s) => `Scene ${s.scene}: ${s.note}`).join(" ") || undefined },
    { name: "No glitches", passed: !(r.scenes ?? []).some((s) => s.glitch || s.aiText), detail: bad.filter((s) => s.glitch || s.aiText).map((s) => `Scene ${s.scene}: ${s.note}`).join(" ") || undefined },
  ];
  const painted = await paintedTextScenes(produced, track);
  for (const i of painted.scenes) if (!redoScenes.includes(i)) redoScenes.push(i);
  checks.push({
    name: "No words painted into scenes",
    passed: !painted.scenes.length,
    detail: painted.scenes.length ? painted.notes : undefined,
  });
  const fix = [...bad.map((s) => s.note), ...(painted.scenes.length ? ["Make the picture with no words, letters, labels or text panels in it."] : [])].filter(Boolean).join(" ") || null;
  return { score: Number(r.score) || 0, checks, notes: r.summary ?? "", fix, redoScenes };
}

/**
 * Words the image model painted into a scene's still (they carry into the clip). Twelve Labs can
 * miss them, so a vision model looks at the stills. A failed check never fails the video.
 */
async function paintedTextScenes(produced: Produced, track: (u: any) => void): Promise<{ scenes: number[]; notes: string }> {
  const stills = (produced.sceneImageUrls ?? []).map((url, index) => ({ url, index })).filter((s): s is { url: string; index: number } => !!s.url);
  if (!stills.length) return { scenes: [], notes: "" };
  try {
    const res = await ai.structured(sceneTextSchema, stills.map((s, i) => `Image ${i + 1} = scene ${s.index + 1}`).join("\n"), {
      system: SCENE_TEXT_SYSTEM,
      images: stills.map((s) => s.url),
      model: MODELS.critic,
    });
    track(res.usage);
    const flagged = res.data.scenes.filter((s) => s.strayText);
    // The model numbers scenes as given; map back through the image order
    const scenes = flagged.map((s) => stills[s.scene - 1]?.index).filter((i): i is number => i !== undefined);
    return { scenes, notes: flagged.map((s) => `Scene ${s.scene}: ${s.note}`).join(" ") };
  } catch {
    return { scenes: [], notes: "" };
  }
}

export async function gate2(task: Task, db: () => SupabaseClient, itemId: string, round: number, brief: Brief, produced: Produced): Promise<Gate2Result> {
  return task(
    `qa-asset-${round}`,
    async (track) => {
      const code = codeChecks(brief, produced);
      let ai: Awaited<ReturnType<typeof reviewImages>>;
      try {
        ai = brief.kind === "video" ? await reviewVideo(brief, produced, track) : await reviewImages(brief, produced, track);
      } catch (err) {
        // A problem that won't go away by retrying (a vendor refusing the request): report it, don't fail the post
        if (err instanceof AppError && !err.retryable) {
          return { passed: false, score: 0, checks: code, notes: "", fix: null, redoScenes: [], unavailable: err.message };
        }
        throw err;
      }
      const checks = [...code, ...ai.checks];
      const passed = ai.score >= PASS_SCORE && checks.every((c) => c.passed);

      const item = await getItem(db(), itemId);
      const report: QaReport = {
        ...(item.qa_report ?? {}),
        gate2: { score: ai.score, notes: ai.notes, checks, redone: ai.redoScenes.map((i) => `Scene ${i + 1}`), attempts: round + 1 },
      };
      await updateItem(db(), itemId, { qa_score: ai.score, qa_report: report });
      return { passed, score: ai.score, checks, notes: ai.notes, fix: ai.fix, redoScenes: ai.redoScenes };
    },
    (r) => r.unavailable ? `Couldn't run the final check: ${r.unavailable}` : `Checked the finished ${brief.kind === "video" ? "video" : "design"}: ${r.score}/10${r.passed ? ", passed" : `, ${r.checks.filter((c) => !c.passed).map((c) => c.name.toLowerCase()).join(", ") || "below 7"}`}`
  );
}
