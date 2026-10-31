// Renders the "ad" composition on this machine, without the server: for checking the templates.
// Usage: node scripts/render-local.ts [timeline.json] [out.mp4]
// Without a file it renders the built-in sample (brand colours only, no media).

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderMedia, selectComposition } from "@remotion/renderer";

const [timelineFile, out = "ad-sample.mp4"] = process.argv.slice(2);
const inputProps = timelineFile ? JSON.parse(await readFile(timelineFile, "utf8")) : undefined;

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: fileURLToPath(new URL("../remotion/index.ts", import.meta.url)) });
const composition = await selectComposition({ serveUrl, id: "ad", inputProps });
const started = Date.now();
await renderMedia({
  composition,
  serveUrl,
  codec: "h264",
  outputLocation: out,
  inputProps,
  timeoutInMilliseconds: 60_000,
  onProgress: ({ progress }) => process.stdout.write(`\r${Math.round(progress * 100)}%`),
});
console.log(`\n${composition.width}x${composition.height}, ${composition.durationInFrames} frames in ${((Date.now() - started) / 1000).toFixed(1)}s → ${out}`);
