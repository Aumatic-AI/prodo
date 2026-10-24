import { env } from "@/config/env";
import { LIMITS } from "@/config/limits";
import { MODELS } from "@/config/models";
import { PRICING } from "@/config/pricing";
import { AppError, notConfigured } from "@/core/errors";
import { jsonOrThrow, request } from "@/providers/http";
import { parseJson } from "@/lib/json";
import type { Result } from "@/providers/usage";

const SERVICE = "Twelve Labs";
const API_BASE = "https://api.twelvelabs.io/v1.3";

/**
 * Asks a question about a video at a public URL and returns the parsed JSON answer.
 * Pegasus 1.5 reads the video directly: no index, no polling. Videos up to 1 hour.
 */
export async function analyze<T = any>(videoUrl: string, prompt: string, jsonSchema?: Record<string, unknown>): Promise<Result<T>> {
  if (!env.TWELVELABS_API_KEY) throw notConfigured(SERVICE);

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
  const body = await jsonOrThrow(SERVICE, res, (b) => b?.message);

  let data: T;
  try {
    data = parseJson<T>(body.data ?? "");
  } catch {
    throw new AppError("Couldn't read the video analysis. Try again.", "UNKNOWN", true);
  }
  return { data, usage: { provider: "twelvelabs", model: MODELS.analyzeVideo, costUsd: PRICING.twelvelabs.analyzePerCall } };
}
