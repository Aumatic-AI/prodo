import type { GetStepTools } from "inngest";
import type { inngest } from "@/jobs/client";
import { toInngestError } from "@/jobs/to-inngest-error";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";

// Image and clip jobs on Kie: start them, then poll with step.sleep (no server runs while waiting).
// A job that fails is made once more (without the reference photo for images), then the error stands.

type Step = GetStepTools<typeof inngest>;

export interface KieJob {
  /** Our name for it, e.g. "scene-2" */
  key: string;
  kind: "image" | "video";
  taskId: string;
  url: string | null;
  prompt: string;
  aspect: string;
  refs: string[];
  /** Video: the first frame and length */
  firstFrame?: string | null;
  duration?: number;
  retried: boolean;
}

export type JobSpec = Omit<KieJob, "taskId" | "url" | "retried">;

export async function startJob(spec: JobSpec): Promise<{ job: KieJob; usage: Usage }> {
  const res =
    spec.kind === "image"
      ? await ai.image.create(spec.prompt, spec.aspect as never, spec.refs)
      : await ai.video.create(spec.prompt, spec.firstFrame ?? undefined, spec.aspect, spec.duration ?? 5);
  return { job: { ...spec, taskId: res.data, url: null, retried: false }, usage: res.usage };
}

export interface WaitOptions {
  first: string;
  every: string;
  max: number;
  /** Called with the cost of a job made again while polling */
  onRetry: (usage: Usage, job: KieJob) => Promise<void>;
}

export async function waitForJobs(step: Step, prefix: string, jobs: KieJob[], o: WaitOptions): Promise<KieJob[] | null> {
  let current = jobs;
  for (let i = 0; i < o.max; i++) {
    await step.sleep(`${prefix}-wait-${i}`, i === 0 ? o.first : o.every);
    current = (await step.run(`${prefix}-poll-${i}`, async () => {
      try {
        const next: KieJob[] = [];
        for (const job of current) {
          if (job.url) {
            next.push(job);
            continue;
          }
          const status = await ai.image.status(job.taskId);
          if (status.state === "success") {
            next.push({ ...job, url: ai.task.resultUrl(status) });
            continue;
          }
          if (status.state !== "fail") {
            next.push(job);
            continue;
          }
          if (job.retried) throw ai.task.error(status, job.kind === "image" ? `${job.key} image` : `${job.key} clip`);
          // One more try; images without the reference photo (a common cause of failures)
          const again = await startJob({ ...job, refs: job.kind === "image" ? [] : job.refs });
          await o.onRetry(again.usage, job);
          next.push({ ...again.job, retried: true });
        }
        return next;
      } catch (err) {
        return toInngestError(err);
      }
    })) as KieJob[];
    if (current.every((j) => j.url)) return current;
  }
  return null;
}
