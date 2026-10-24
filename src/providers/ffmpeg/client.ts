import { env } from "@/config/env";
import { AppError, notConfigured } from "@/core/errors";
import { jsonOrThrow, request } from "@/providers/http";

// Our own FFmpeg worker (self-hosted on Hostinger). See worker/README.md.
const SERVICE = "The video renderer";

export interface RenderJob {
  /** Storage keys or allowed https URLs. Referenced in args as {input0}, {input1}… */
  inputs: string[];
  /** ffmpeg arguments. {output} is the result file. */
  args: string[];
  /** Where the worker saves the result in our storage */
  outputKey: string;
  contentType?: string;
}

export interface RenderStatus {
  status: "queued" | "running" | "done" | "failed";
  outputKey?: string;
  error?: string;
}

function config() {
  if (!env.FFMPEG_WORKER_URL || !env.FFMPEG_WORKER_SECRET) throw notConfigured(SERVICE);
  return { base: env.FFMPEG_WORKER_URL.replace(/\/$/, ""), headers: { "x-worker-secret": env.FFMPEG_WORKER_SECRET } };
}

export async function submitJob(job: RenderJob): Promise<string> {
  const { base, headers } = config();
  const res = await request(SERVICE, `${base}/jobs`, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ contentType: "video/mp4", ...job }),
  });
  const data = await jsonOrThrow(SERVICE, res, (b) => b?.error);
  return data.jobId;
}

export async function getJob(jobId: string): Promise<RenderStatus> {
  const { base, headers } = config();
  const res = await request(SERVICE, `${base}/jobs/${encodeURIComponent(jobId)}`, { headers });
  if (res.status === 404) {
    // Worker restarted and lost the job
    throw new AppError("The video renderer lost this job. Try again.", "UNKNOWN", false);
  }
  return jsonOrThrow(SERVICE, res, (b) => b?.error);
}
