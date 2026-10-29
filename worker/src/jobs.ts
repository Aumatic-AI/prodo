// The waiting line. ffmpeg jobs and Remotion renders share one list of jobs but have their own
// limits, because a render (a whole browser) is much heavier than an ffmpeg job.

import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { KEEP_FINISHED_MS, MAX_CONCURRENT, MAX_RENDERS } from "./config.ts";
import { runFfmpegJob, type FfmpegInput } from "./ffmpeg.ts";
import { runRender, type RenderInput } from "./render.ts";

type Status = "queued" | "running" | "done" | "failed";

export type JobRequest = { kind: "ffmpeg"; input: FfmpegInput } | { kind: "render"; input: RenderInput };

type Job = JobRequest & {
  id: string;
  status: Status;
  error?: string;
  finishedAt?: number;
};

const LIMITS: Record<Job["kind"], number> = { ffmpeg: MAX_CONCURRENT, render: MAX_RENDERS };

const jobs = new Map<string, Job>();
const queue: Job[] = [];
const running: Record<Job["kind"], number> = { ffmpeg: 0, render: 0 };

export function addJob(request: JobRequest): string {
  const job: Job = { ...request, id: randomUUID(), status: "queued" };
  jobs.set(job.id, job);
  queue.push(job);
  pump();
  return job.id;
}

/** What Prodo sees when it checks on a job. */
export function jobStatus(id: string) {
  const job = jobs.get(id);
  if (!job) return null;
  return { status: job.status, outputKey: job.status === "done" ? job.input.outputKey : undefined, error: job.error };
}

export function load() {
  const queued = (kind: Job["kind"]) => queue.filter((j) => j.kind === kind).length;
  return {
    ffmpeg: { running: running.ffmpeg, queued: queued("ffmpeg") },
    render: { running: running.render, queued: queued("render") },
  };
}

/** Each job gets its own temp folder, deleted afterwards whatever happens. */
async function run(job: Job): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "prodo-"));
  try {
    if (job.kind === "ffmpeg") await runFfmpegJob(job.input, dir);
    else await runRender(job.input, dir);
    job.status = "done";
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
  } finally {
    job.finishedAt = Date.now();
    await rm(dir, { recursive: true, force: true });
  }
}

/** Starts every queued job that has room, oldest first, without letting one kind block the other. */
function pump(): void {
  for (const job of [...queue]) {
    if (running[job.kind] >= LIMITS[job.kind]) continue;
    queue.splice(queue.indexOf(job), 1);
    job.status = "running";
    running[job.kind]++;
    run(job).finally(() => {
      running[job.kind]--;
      pump();
    });
  }
}

// Forget finished jobs after an hour
setInterval(() => {
  const cutoff = Date.now() - KEEP_FINISHED_MS;
  for (const [id, job] of jobs) if (job.finishedAt && job.finishedAt < cutoff) jobs.delete(id);
}, 5 * 60_000).unref();
