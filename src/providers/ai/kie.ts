import { env } from "@/config/env";
import { MODELS } from "@/config/models";
import { PRICING } from "@/config/pricing";
import { AppError, notConfigured } from "@/core/errors";
import { cleanReason, quoted, statusText } from "@/core/error-text";
import { request, type KnownErrors } from "@/providers/http";
import type { Result } from "@/providers/usage";

const SERVICE = "Kie.ai";
const API_BASE = "https://api.kie.ai/api/v1/jobs";

export type KieAspectRatio = "1:1" | "2:3" | "3:2" | "9:16" | "16:9" | "21:9" | "auto";

export interface TaskStatus {
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultJson: string;
  failMsg?: string;
  failCode?: string;
}

function headers() {
  if (!env.KIE_API_KEY) throw notConfigured(SERVICE, "KIE_API_KEY is empty on the server");
  return { "Content-Type": "application/json", Authorization: `Bearer ${env.KIE_API_KEY}` };
}

// Kie answers HTTP 200 even on failure: the real result is the body's `code`, with `msg` saying why
// (docs.kie.ai/getting-started). Its own msg follows each plain sentence.
const KNOWN: KnownErrors = {
  401: { say: "it rejected our API key (or our server's address isn't on the key's allowed list)", type: "NOT_CONFIGURED", retry: false },
  402: { say: "it's out of credit", type: "OUT_OF_CREDIT", retry: false },
  404: { say: "it doesn't have this model or endpoint", type: "NOT_CONFIGURED", retry: false },
  408: { say: "it returned no result for over 10 minutes", type: "TIMEOUT", retry: true },
  422: { say: "it didn't accept the request", type: "INVALID_INPUT", retry: false },
  429: { say: "too many requests (it allows 20 new jobs every 10 seconds)", type: "RATE_LIMITED", retry: true },
  433: { say: "the API key's own usage cap is reached", type: "LIMIT_REACHED", retry: false },
  455: { say: "it's down for maintenance", type: "PROVIDER_DOWN", retry: true },
  500: { say: "it had a server error", type: "PROVIDER_DOWN", retry: true },
  501: { say: "the generation failed", type: "PROVIDER_DOWN", retry: true },
  505: { say: "this model is turned off on Kie's side", type: "NOT_CONFIGURED", retry: false },
};

function codeError(code: number, msg?: string, what?: string): AppError {
  const known = KNOWN[code];
  const label = `${SERVICE}${what ? ` (${what})` : ""}`;
  // Kie also sends input problems as code 500, e.g. "This field is required"
  if ((code === 500 || !known) && msg && /required|invalid|must|not supported|too long|exceed|format/i.test(msg)) {
    return new AppError(`${label} didn't accept the request (code ${code})${quoted(msg)}.`, "INVALID_INPUT", false);
  }
  if (!known) return new AppError(`${label} answered with code ${code}${quoted(msg)}.`, "PROVIDER_DOWN", true);
  const wait = known.type === "RATE_LIMITED" && known.retry ? 60_000 : undefined;
  return new AppError(`${label}: ${known.say} (code ${code})${quoted(msg)}.`, known.type, known.retry, wait);
}

async function call(path: string, init: RequestInit, what: string): Promise<any> {
  const res = await request(SERVICE, `${API_BASE}${path}`, init);
  const text = await res.text().catch(() => "");
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  if (!body) {
    throw new AppError(`${SERVICE} (${what}) sent a reply we couldn't read (${statusText(res.status)})${quoted(cleanReason(text, 120))}.`, "PROVIDER_DOWN", true);
  }
  if (body.code !== 200) throw codeError(Number(body.code), body.msg, what);
  return body.data;
}

async function createTask(model: string, input: Record<string, unknown>): Promise<string> {
  const what = `starting ${model}`;
  const data = await call("/createTask", { method: "POST", headers: headers(), body: JSON.stringify({ model, input }) }, what);
  const taskId = data?.taskId;
  if (!taskId) throw new AppError(`${SERVICE} (${what}) said it started but sent no task id.`, "PROVIDER_DOWN", true);
  return taskId;
}

export async function createImageTask(
  prompt: string,
  aspectRatio: KieAspectRatio = "2:3",
  referenceImageUrls: string[] = [],
  resolution: "1K" | "2K" | "4K" = "2K"
): Promise<Result<string>> {
  const taskId = await createTask(MODELS.image, {
    prompt,
    output_format: "png",
    aspect_ratio: aspectRatio,
    resolution,
    image_input: referenceImageUrls,
  });
  return { data: taskId, usage: { provider: "kie", model: MODELS.image, costUsd: PRICING.kie.imagePerTask } };
}

/**
 * GPT Image 2 on Kie (docs.kie.ai/market/gpt/gpt-image-2-image-to-image): the real product photos and the
 * logo go in `input_urls` (up to 16), and the picture comes out in the canvas's own proportions. At 2K Kie
 * doesn't take 4:5, so 4:5 is made at 1K. With no reference images the text-to-image model is used.
 */
export async function createGptImageTask(prompt: string, aspectRatio: "1:1" | "4:5" | "9:16" | "16:9", resolution: "1K" | "2K", referenceImageUrls: string[] = []): Promise<Result<string>> {
  const withRefs = referenceImageUrls.length > 0;
  const model = withRefs ? "gpt-image-2-image-to-image" : "gpt-image-2-text-to-image";
  const taskId = await createTask(model, { prompt, aspect_ratio: aspectRatio, resolution, ...(withRefs ? { input_urls: referenceImageUrls } : {}) });
  return { data: taskId, usage: { provider: "kie", model, costUsd: PRICING.kie.gptImage[resolution] } };
}

export async function createVideoTask(
  prompt: string,
  firstFrameUrl: string | undefined,
  aspectRatio = "9:16",
  durationSec = 4
): Promise<Result<string>> {
  const taskId = await createTask(MODELS.video, {
    prompt,
    aspect_ratio: aspectRatio,
    duration: String(durationSec),
    resolution: "720p",
    // Narration is added in the stitch step, so no clip audio
    generate_audio: false,
    ...(firstFrameUrl ? { first_frame_url: firstFrameUrl } : {}),
  });
  return {
    data: taskId,
    usage: { provider: "kie", model: MODELS.video, costUsd: PRICING.kie.videoPerSecond * durationSec },
  };
}

export async function checkTaskStatus(taskId: string): Promise<TaskStatus> {
  const data = await call(`/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: headers() }, `checking task ${taskId}`);
  return data ?? { state: "waiting", resultJson: "" };
}

export function parseResultUrl(resultJson: string): string | null {
  try {
    const parsed = JSON.parse(resultJson);
    return parsed.resultUrls?.[0] || parsed.urls?.[0] || null;
  } catch {
    return null;
  }
}

/**
 * A failed task as a plain error with Kie's own reason. Content blocks and rejected inputs (failCode
 * 400) aren't retried; Kie's own failures (failCode 500) are. Failed tasks cost no credits.
 */
export function taskError(status: TaskStatus, what = "image"): AppError {
  const reason = cleanReason(status.failMsg || "no reason given");
  const code = status.failCode ? `, failCode ${status.failCode}` : "";
  if (/sensitive|policy|nsfw|safety|flagged|unsafe/i.test(reason)) {
    return new AppError(`${SERVICE} blocked the ${what} as sensitive content (${reason}${code}). Reword the idea and try again.`, "CONTENT_BLOCKED", false);
  }
  if (/download|fetch the image|files_url/i.test(reason)) {
    return new AppError(`${SERVICE} couldn't download a reference picture for the ${what} (${reason}${code}).`, "PROVIDER_DOWN", true);
  }
  const rejected = status.failCode === "400";
  return new AppError(
    `${SERVICE} couldn't make the ${what}: "${reason}"${code ? ` (${code.slice(2)})` : ""}.`,
    rejected ? "INVALID_INPUT" : "PROVIDER_DOWN",
    !rejected
  );
}

/** Result file of a finished task, or an error if Kie sent none. */
export function resultUrlOrThrow(status: TaskStatus): string {
  const url = parseResultUrl(status.resultJson);
  if (!url) throw new AppError(`${SERVICE} said the task succeeded but sent no file (result: ${cleanReason(status.resultJson || "empty", 120)}).`, "PROVIDER_DOWN", true);
  return url;
}
