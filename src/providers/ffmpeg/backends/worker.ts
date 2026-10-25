import { env } from "@/config/env";
import { AppError, notConfigured } from "@/core/errors";
import { jsonOrThrow, request } from "@/providers/http";
import type { RenderBackend, RenderJob, RenderStatus } from "../types";

// Our own FFmpeg worker (self-hosted on Hostinger). See worker/README.md.
const SERVICE = "The video renderer";

function config() {
  if (!env.FFMPEG_WORKER_URL || !env.FFMPEG_WORKER_SECRET) throw notConfigured(SERVICE);
  return { base: env.FFMPEG_WORKER_URL.replace(/\/$/, ""), headers: { "x-worker-secret": env.FFMPEG_WORKER_SECRET } };
}

export const workerBackend: RenderBackend = {
  id: "worker",
  captionsInGraph: true,

  async ready() {
    try {
      const res = await request(SERVICE, `${config().base}/health`, {}, 8_000);
      if (res.ok) return { ok: true };
      return { ok: false, reason: `The video renderer isn't answering (status ${res.status}). Check the worker on the server.` };
    } catch {
      return { ok: false, reason: "The video renderer can't be reached. Check that the worker on the server is running." };
    }
  },

  async submit(job: RenderJob) {
    const { base, headers } = config();
    const res = await request(SERVICE, `${base}/jobs`, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ contentType: "video/mp4", ...job }),
    });
    const data = await jsonOrThrow(SERVICE, res, (b) => b?.error);
    return data.jobId as string;
  },

  async status(id: string): Promise<RenderStatus> {
    const { base, headers } = config();
    const res = await request(SERVICE, `${base}/jobs/${encodeURIComponent(id)}`, { headers });
    // Worker restarted and lost the job
    if (res.status === 404) throw new AppError("The video renderer lost this job. Try again.", "UNKNOWN", false);
    return jsonOrThrow(SERVICE, res, (b) => b?.error);
  },
};
