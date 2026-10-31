// Builds a sample video Timeline with a real business's brand and photos (sample-timeline.ts) and
// writes it as JSON, to render on your own computer: cd worker && node scripts/render-local.ts <json> <mp4>
// Usage: npm run smoke scripts/check/video-timeline.ts <out.json> [preset] [9:16|4:5]
import { writeFile } from "node:fs/promises";
import { sampleBusinessId, sampleTimeline } from "./sample-timeline";

const [out = "timeline.json", preset = "bold", ratio = "9:16"] = process.argv.slice(2);
const timeline = await sampleTimeline(await sampleBusinessId(), preset, ratio);
await writeFile(out, JSON.stringify(timeline, null, 2));
console.log(`${timeline.scenes.length} scenes, ${(timeline.durationInFrames / 30).toFixed(1)}s, preset ${timeline.preset}, ${timeline.captions.length} caption pages, ${timeline.layers.length} layers → ${out}`);
