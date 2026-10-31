// One real render on the deployed video worker: the "check" template, saved to storage.
// Needs FFMPEG_WORKER_URL and FFMPEG_WORKER_SECRET. Uses only our own VPS (no paid API).

import { env } from "@/config/env";

const url = env.FFMPEG_WORKER_URL;
const secret = env.FFMPEG_WORKER_SECRET;
if (!url || !secret) throw new Error("Set FFMPEG_WORKER_URL and FFMPEG_WORKER_SECRET in .env.local");

const headers = { "x-worker-secret": secret, "Content-Type": "application/json" };
console.log("health:", await (await fetch(`${url}/health`)).json());

const outputKey = `tmp/smoke/render-check-${Date.now()}.mp4`;
const start = await fetch(`${url}/render`, {
  method: "POST",
  headers,
  body: JSON.stringify({ template: "check-9x16", props: { title: "Prodo renders work", color: "#2f45c5", image: null }, outputKey }),
});
const { jobId, error } = await start.json();
if (!jobId) throw new Error(`Render refused: ${error}`);

const started = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 3000));
  const job = await (await fetch(`${url}/jobs/${jobId}`, { headers })).json();
  if (job.status === "done") {
    console.log(`done in ${((Date.now() - started) / 1000).toFixed(0)}s → ${job.outputKey}`);
    break;
  }
  if (job.status === "failed") throw new Error(`Render failed: ${job.error}`);
}
