// Real renders on Upload-Post's FFmpeg API through our own code path (no worker needed):
// 1. a 2-second test clip, 2. the full video composer with two scenes, burned-in captions and an
// end card. Results in storage: tmp/smoke/up-clip.mp4 and tmp/smoke/up-compose.mp4.
// Uses a few of Upload-Post's monthly processing minutes. Usage: npm run smoke scripts/smoke/upload-post-render.ts
import sharp from "sharp";
import { publicUrl } from "@/providers/storage/paths";
import { upload } from "@/providers/storage/r2";
import { uploadPostBackend } from "@/providers/ffmpeg/backends/upload-post";
import { buildComposeJob } from "@/providers/ffmpeg/compose-video";
import { buildAss } from "@/creative/subtitles";
import { CANVAS } from "@/creative/sizes";

async function wait(id: string, outputKey: string) {
  for (let i = 0; i < 60; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const s = await uploadPostBackend.status(id, outputKey);
    if (s.status === "done" || s.status === "failed") return s;
  }
  return { status: "timeout" };
}

const card = await sharp({ create: { width: 1080, height: 1920, channels: 3, background: "#15171c" } }).png().toBuffer();
await upload("tmp/smoke/up-endcard.png", card, "image/png");
const tile = await sharp({ create: { width: 720, height: 1280, channels: 3, background: "#2f45c5" } }).png().toBuffer();
await upload("tmp/smoke/up-tile.png", tile, "image/png");
const clipId = await uploadPostBackend.submit({
  inputs: ["tmp/smoke/up-tile.png"],
  args: ["-loop", "1", "-i", "{input0}", "-t", "3", "-c:v", "libx264", "-pix_fmt", "yuv420p", "{output}"],
  outputKey: "tmp/smoke/up-clip.mp4",
});
console.log("clip:", JSON.stringify(await wait(clipId, "tmp/smoke/up-clip.mp4")));

const canvas = CANVAS["9:16"];
const ass = buildAss({
  canvas,
  words: [
    { word: "Your", start: 0.2, end: 0.5 },
    { word: "week,", start: 0.5, end: 0.9 },
    { word: "planned.", start: 0.9, end: 1.5 },
    { word: "Posts", start: 2.2, end: 2.6 },
    { word: "made", start: 2.6, end: 3.0 },
    { word: "for", start: 3.0, end: 3.2 },
    { word: "you.", start: 3.2, end: 3.8 },
  ],
  overlays: [{ text: "Prodo test", start: 0, end: 2 }],
  font: "Inter",
  highlight: "#ffd166",
  highlightText: "#111111",
});
await upload("tmp/smoke/up-captions.ass", Buffer.from(ass, "utf8"), "text/plain");

const clipUrl = publicUrl("tmp/smoke/up-clip.mp4");
const job = buildComposeJob({
  width: 1080,
  height: 1920,
  clipUrls: [clipUrl, clipUrl],
  sceneDurations: [2, 2],
  subtitlesKey: "tmp/smoke/up-captions.ass",
  endCardKey: "tmp/smoke/up-endcard.png",
  endCardSec: 1.5,
  outputKey: "tmp/smoke/up-compose.mp4",
  captionsInGraph: false,
});
const id = await uploadPostBackend.submit({ ...job, outputKey: "tmp/smoke/up-compose.mp4" });
const result = await wait(id, "tmp/smoke/up-compose.mp4");
console.log("compose:", JSON.stringify(result));
if (result.status === "done") console.log("open:", publicUrl("tmp/smoke/up-compose.mp4"));
