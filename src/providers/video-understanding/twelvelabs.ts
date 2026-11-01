import { env } from "@/config/env";
import { LIMITS } from "@/config/limits";
import { MODELS } from "@/config/models";
import { PRICING } from "@/config/pricing";
import { AppError, notConfigured } from "@/core/errors";
import { cleanReason } from "@/core/error-text";
import { jsonOrThrow, request, shortUrl, type KnownErrors } from "@/providers/http";
import { parseJson } from "@/lib/json";
import type { Result } from "@/providers/usage";

const SERVICE = "Twelve Labs";
const API_BASE = "https://api.twelvelabs.io/v1.3";

// Its documented error codes (docs.twelvelabs.io/v1.3/api-reference/error-codes). Its own message
// follows each one and carries the exact limit ("The minimum duration is 4 seconds").
const KNOWN: KnownErrors = {
  api_key_invalid: { say: "it rejected our API key", type: "NOT_CONFIGURED", retry: false },
  api_allowed_for_paid_plan: { say: "this needs a paid Twelve Labs plan", type: "NOT_CONFIGURED", retry: false },
  api_not_allowed: { say: "this account isn't allowed to use the API", type: "NOT_CONFIGURED", retry: false },
  region_not_allowed: { say: "it doesn't serve the region our server runs in", type: "NOT_CONFIGURED", retry: false },
  usage_limit_exceeded: { say: "the plan's usage limit is used up", type: "OUT_OF_CREDIT", retry: false },
  workload_allowance_exhausted: { say: "the plan's allowance is used up and overage is off", type: "OUT_OF_CREDIT", retry: false },
  too_many_requests: { say: "too many requests; it asked us to wait", type: "RATE_LIMITED", retry: true },
  request_canceled_or_timed_out: { say: "the request was cancelled or timed out on its side", type: "TIMEOUT", retry: true },
  token_limit_exceeded: { say: "the video and the question are too long for the model", type: "INVALID_INPUT", retry: false },
  media_url_not_accessible: { say: "it couldn't open the video link", type: "PROVIDER_DOWN", retry: true },
  media_url_unsupported_format: { say: "the link isn't a video file it can read", type: "INVALID_INPUT", retry: false },
  media_url_file_broken: { say: "the video file is damaged", type: "INVALID_INPUT", retry: false },
  video_file_broken: { say: "the video file is damaged", type: "INVALID_INPUT", retry: false },
  video_file_live: { say: "it's a live stream, not a finished video", type: "INVALID_INPUT", retry: false },
  video_duration_too_short: { say: "the video is too short to watch", type: "INVALID_INPUT", retry: false },
  video_duration_too_long: { say: "the video is too long to watch in one go (1 hour at most)", type: "INVALID_INPUT", retry: false },
  video_resolution_too_low: { say: "the video's resolution is too low (360×360 at least)", type: "INVALID_INPUT", retry: false },
  video_resolution_too_high: { say: "the video's resolution is too high (5184×2160 at most)", type: "INVALID_INPUT", retry: false },
  video_resolution_invalid_aspect_ratio: { say: "the video's shape is outside what it reads (between 1:1 and 1:2.4)", type: "INVALID_INPUT", retry: false },
  video_filesize_too_large: { say: "the video file is too big", type: "INVALID_INPUT", retry: false },
  media_filesize_too_large: { say: "the video file is too big", type: "INVALID_INPUT", retry: false },
  parameter_invalid: { say: "it didn't accept a setting we sent", type: "INVALID_INPUT", retry: false },
  parameter_not_provided: { say: "a setting it needs was missing", type: "INVALID_INPUT", retry: false },
  parameter_unknown: { say: "it didn't recognise a setting we sent", type: "INVALID_INPUT", retry: false },
};

/**
 * Asks a question about a video at a public URL and returns the parsed JSON answer.
 * Pegasus 1.5 reads the video directly: no index, no polling. Videos up to 1 hour.
 */
export async function analyze<T = any>(videoUrl: string, prompt: string, jsonSchema?: Record<string, unknown>): Promise<Result<T>> {
  if (!env.TWELVELABS_API_KEY) throw notConfigured(SERVICE, "TWELVELABS_API_KEY is empty on the server");
  const what = `watching ${shortUrl(videoUrl)}`;

  const res = await request(
    SERVICE,
    `${API_BASE}/analyze`,
    {
      method: "POST",
      headers: { "x-api-key": env.TWELVELABS_API_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({
        model_name: MODELS.analyzeVideo,
        video: { type: "url", url: videoUrl },
        prompt,
        stream: false,
        temperature: 0.2,
        ...(jsonSchema ? { response_format: { type: "json_schema", json_schema: jsonSchema } } : {}),
      }),
    },
    // Reading a long video can take a few minutes
    LIMITS.downloadTimeoutMs
  );
  // Its errors carry a code and a message: "video_resolution_too_low: The video resolution is too low…"
  const body = await jsonOrThrow(SERVICE, res, undefined, what, KNOWN);
  // A 200 can still be cut short: the answer hit the length limit and its JSON is incomplete
  if (body?.finish_reason === "length") throw new AppError(`${SERVICE} (${what}): the answer was cut off at the length limit before it finished.`, "UNKNOWN", true);
  if (!body?.data) throw new AppError(`${SERVICE} (${what}) sent an empty answer (finish reason: ${body?.finish_reason ?? "none"}).`, "UNKNOWN", true);

  let data: T;
  try {
    data = parseJson<T>(body.data);
  } catch {
    throw new AppError(`${SERVICE} (${what}) answered, but not in valid JSON: "${cleanReason(body.data, 120)}".`, "UNKNOWN", true);
  }
  return { data, usage: { provider: "twelvelabs", model: MODELS.analyzeVideo, costUsd: PRICING.twelvelabs.analyzePerCall } };
}
