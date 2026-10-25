import { env } from "@/config/env";
import { MODELS } from "@/config/models";
import { PRICING } from "@/config/pricing";
import { AppError, notConfigured } from "@/core/errors";
import { request } from "@/providers/http";
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
  if (!env.KIE_API_KEY) throw notConfigured(SERVICE);
  return { "Content-Type": "application/json", Authorization: `Bearer ${env.KIE_API_KEY}` };
}

// Kie answers HTTP 200 even on failure: the real result is the body's `code`.
function codeError(code: number, msg?: string): AppError {
  switch (code) {
    case 401:
      return notConfigured(SERVICE);
    case 402:
      return new AppError("Kie.ai is out of credit. Please contact your admin.", "OUT_OF_CREDIT", false);
    case 422:
      return new AppError(`Kie.ai couldn't accept this: "${msg ?? "invalid input"}". Change the idea and try again.`, "INVALID_INPUT", false);
    case 429:
      return new AppError("Kie.ai is busy. Try again in a few minutes.", "RATE_LIMITED", true, 60_000);
    case 455:
      return new AppError("Kie.ai is under maintenance. Try again later.", "PROVIDER_DOWN", true);
    case 505:
      return new AppError("This Kie.ai model is turned off. Please contact your admin.", "NOT_CONFIGURED", false);
    default:
      // Kie also sends input problems as code 500, e.g. "This field is required"
      if (msg && /required|invalid|must|not supported|too long|exceed|format/i.test(msg)) {
        return new AppError(`Kie.ai couldn't accept this: "${msg}". Change the idea and try again.`, "INVALID_INPUT", false);
      }
      return new AppError("Kie.ai isn't responding. Try again in a few minutes.", "PROVIDER_DOWN", true);
  }
}

async function call(path: string, init: RequestInit): Promise<any> {
  const res = await request(SERVICE, `${API_BASE}${path}`, init);
  const body = await res.json().catch(() => null);
  if (!body) throw codeError(res.status >= 500 ? 500 : res.status);
  if (body.code !== 200) throw codeError(body.code, body.msg);
  return body.data;
}

async function createTask(model: string, input: Record<string, unknown>): Promise<string> {
  const data = await call("/createTask", { method: "POST", headers: headers(), body: JSON.stringify({ model, input }) });
  const taskId = data?.taskId;
  if (!taskId) throw codeError(500);
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
  const data = await call(`/recordInfo?taskId=${encodeURIComponent(taskId)}`, { headers: headers() });
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

/** Turns a failed task into a plain error. Content blocks are not retried. */
export function taskError(status: TaskStatus, what = "image"): AppError {
  const reason = status.failMsg || status.failCode || "unknown reason";
  if (/sensitive|policy|nsfw|safety/i.test(reason)) {
    return new AppError("Kie.ai blocked this as sensitive content. Reword the idea and try again.", "CONTENT_BLOCKED", false);
  }
  return new AppError(`The ${what} couldn't be made: "${reason}". Try again.`, "UNKNOWN", true);
}

/** Result file of a finished task, or an error if Kie sent none. */
export function resultUrlOrThrow(status: TaskStatus): string {
  const url = parseResultUrl(status.resultJson);
  if (!url) throw new AppError("Kie.ai finished but sent no file. Try again.", "UNKNOWN", true);
  return url;
}
