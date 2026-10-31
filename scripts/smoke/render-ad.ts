// One real ad render on the deployed video worker: a sample Timeline with a real business's brand
// and photos (scripts/check/sample-timeline.ts) → the worker draws it with Remotion, levels the
// sound and saves it to storage. Free: no AI calls, only our own server and storage (tmp/, deleted
// after 7 days). Needs FFMPEG_WORKER_URL and FFMPEG_WORKER_SECRET.
// Usage: npm run smoke scripts/smoke/render-ad.ts [preset] [9:16|4:5]
import { getJob, submitRender } from "@/providers/ffmpeg/client";
import { publicUrl, tmpKey } from "@/providers/storage/paths";
import { sampleBusinessId, sampleTimeline } from "../check/sample-timeline";

const [preset = "bold", ratio = "9:16"] = process.argv.slice(2);
const timeline = await sampleTimeline(await sampleBusinessId(), preset, ratio);
const key = tmpKey(`smoke/ad-${preset}-${ratio.replace(":", "x")}-${Date.now()}.mp4`);
const jobId = await submitRender("ad", timeline as unknown as Record<string, unknown>, key);
console.log(`Sent a ${(timeline.durationInFrames / 30).toFixed(1)}s ${preset} ad (${ratio}) to the worker`);

const started = Date.now();
for (;;) {
  await new Promise((r) => setTimeout(r, 5000));
  const job = await getJob(jobId);
  if (job.status === "done") {
    console.log(`Done in ${Math.round((Date.now() - started) / 1000)}s → ${publicUrl(key)}`);
    break;
  }
  if (job.status === "failed") throw new Error(`Render failed: ${job.error}`);
  process.stdout.write(`${job.status}… `);
}
