// Renders single frames of the "ad" composition to PNGs, for checking the look.
// Usage: node scripts/stills-local.ts <outDir> <frame> [frame…] [--props timeline.json]
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser, renderStill, selectComposition } from "@remotion/renderer";

const args = process.argv.slice(2);
const propsAt = args.indexOf("--props");
const inputProps = propsAt >= 0 ? JSON.parse(await readFile(args[propsAt + 1], "utf8")) : undefined;
const [outDir, ...frames] = args.filter((_, i) => propsAt < 0 || (i !== propsAt && i !== propsAt + 1));

await ensureBrowser();
const serveUrl = await bundle({ entryPoint: fileURLToPath(new URL("../remotion/index.ts", import.meta.url)) });
const composition = await selectComposition({ serveUrl, id: "ad", inputProps });
for (const frame of frames.map(Number)) {
  const output = join(outDir, `frame-${frame}.png`);
  await renderStill({ composition, serveUrl, frame, output, inputProps, scale: 0.4 });
  console.log(output);
}
