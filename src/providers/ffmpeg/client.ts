import { env } from "@/config/env";
import { AppError } from "@/core/errors";
import { uploadPostBackend } from "./backends/upload-post";
import { workerBackend } from "./backends/worker";
import type { Readiness, RenderBackend, RenderJob, RenderStatus } from "./types";

// Where videos are put together. Our own worker on the Hostinger VPS when FFMPEG_WORKER_URL and
// FFMPEG_WORKER_SECRET are set; until then Upload-Post's hosted FFmpeg API (UPLOAD_POST_API_KEY).
// Nothing else changes when the worker is connected: callers use submitJob / getJob as before.
// RENDERER=worker or RENDERER=upload-post forces one.

export type { RenderJob, RenderStatus } from "./types";

const BACKENDS: Record<RenderBackend["id"], RenderBackend> = { worker: workerBackend, "upload-post": uploadPostBackend };

/** The backend new jobs go to. */
export function renderBackend(): RenderBackend {
  if (env.RENDERER === "worker" || env.RENDERER === "upload-post") return BACKENDS[env.RENDERER];
  if (env.FFMPEG_WORKER_URL && env.FFMPEG_WORKER_SECRET) return workerBackend;
  return uploadPostBackend;
}

/** Job ids carry their backend and output, so a job finishes where it started even if settings change. */
const SEP = "|";

export async function submitJob(job: RenderJob): Promise<string> {
  const backend = renderBackend();
  const id = await backend.submit(job);
  return [backend.id, id, job.outputKey].join(SEP);
}

export async function getJob(jobId: string): Promise<RenderStatus> {
  const [backendId, id, ...rest] = jobId.split(SEP);
  // Ids from before backends existed are plain worker ids
  if (!id) return workerBackend.status(jobId, "");
  const backend = BACKENDS[backendId as RenderBackend["id"]];
  if (!backend) throw new AppError("Unknown video job. Try again.", "UNKNOWN", false);
  return backend.status(id, rest.join(SEP));
}

/**
 * Whether videos can be made right now (settings present; our worker also answers its health
 * check). Checked before any money is spent on scene images, clips or voice.
 */
export async function videoReady(): Promise<Readiness> {
  return renderBackend().ready();
}

/** Throws a plain, non-retryable error when videos can't be made, before anything is spent. */
export async function assertVideoReady(): Promise<void> {
  const check = await videoReady();
  if (!check.ok) throw new AppError(check.reason, "NOT_CONFIGURED", false);
}
