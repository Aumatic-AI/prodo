import { env } from "@/config/env";
import { getJob, submitJob } from "@/providers/ffmpeg/client";
import { smoke } from "./_run";

if (!env.FFMPEG_WORKER_URL || !env.FFMPEG_WORKER_SECRET) {
  console.error("FAIL worker: set FFMPEG_WORKER_URL and FFMPEG_WORKER_SECRET in .env.local");
  process.exit(1);
}

await smoke("worker health", async () => {
  const res = await fetch(`${env.FFMPEG_WORKER_URL}/health`);
  return { result: await res.json() };
});

await smoke("worker rejects a missing secret (expect 401)", async () => {
  const res = await fetch(`${env.FFMPEG_WORKER_URL}/jobs`, { method: "POST", body: "{}" });
  if (res.status !== 401) throw new Error(`Expected 401, got ${res.status}`);
  return { result: res.status };
});

// Renders a 2-second blue test clip and saves it to storage as tmp/smoke/worker-test.mp4
await smoke("worker render", async () => {
  const jobId = await submitJob({
    inputs: [],
    args: ["-f", "lavfi", "-i", "color=c=blue:s=320x240:d=2", "-c:v", "libx264", "-pix_fmt", "yuv420p", "{output}"],
    outputKey: "tmp/smoke/worker-test.mp4",
  });
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 3000));
    const job = await getJob(jobId);
    if (job.status === "done" || job.status === "failed") return { result: job };
  }
  return { result: { jobId, status: "still running" } };
});
