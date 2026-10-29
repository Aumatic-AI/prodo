// Runs once when the Docker image is built: bundles the templates into ./bundle and downloads
// the headless browser Remotion renders with, so the first render doesn't wait for either.

import { fileURLToPath } from "node:url";
import { bundle } from "@remotion/bundler";
import { ensureBrowser } from "@remotion/renderer";

const outDir = fileURLToPath(new URL("../bundle", import.meta.url));
const entryPoint = fileURLToPath(new URL("../remotion/index.ts", import.meta.url));

await bundle({ entryPoint, outDir });
console.log(`Templates bundled into ${outDir}`);

await ensureBrowser();
console.log("Browser ready");
