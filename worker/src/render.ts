// Remotion renders: a template (a composition in ../remotion) filled with data (props) becomes an MP4.
// The templates are bundled once at build time; each render opens them in a headless browser.

import { join } from "node:path";
import { makeCancelSignal, renderMedia, selectComposition } from "@remotion/renderer";
import { BUNDLE_DIR, JOB_TIMEOUT_MS, RENDER_CONCURRENCY, VIDEO_CACHE_BYTES } from "./config.ts";
import { isAllowedUrl, uploadResult } from "./storage.ts";
import { runFfmpeg } from "./ffmpeg.ts";

/** Social platforms play videos at about -14 LUFS: every render is levelled to that */
const LOUDNESS = "loudnorm=I=-14:TP=-1.5:LRA=11";

export interface RenderInput {
  /** Composition id: "ad" (Prodo's video ads, any size) or "check-9x16" */
  template: string;
  props: Record<string, unknown>;
  outputKey: string;
}

/** Every link in the props must be one we allow: the browser fetches them while rendering. */
export function assertSafeProps(value: unknown, path = "props"): void {
  if (typeof value === "string") {
    // Text like "Shop: now" isn't a link; web, file and socket addresses are
    const isLink = /^(https?|file|ftp|wss?):/i.test(value) || value.startsWith("//");
    if (isLink && !isAllowedUrl(value)) throw new Error(`Link not allowed in ${path}`);
  } else if (Array.isArray(value)) {
    value.forEach((v, i) => assertSafeProps(v, `${path}[${i}]`));
  } else if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) assertSafeProps(v, `${path}.${k}`);
  }
}

/** Renders the template into `dir`, then uploads the MP4. */
export async function runRender(job: RenderInput, dir: string): Promise<void> {
  const composition = await selectComposition({ serveUrl: BUNDLE_DIR, id: job.template, inputProps: job.props });
  const output = join(dir, "output.mp4");

  const { cancelSignal, cancel } = makeCancelSignal();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    cancel();
  }, JOB_TIMEOUT_MS);

  try {
    await renderMedia({
      composition,
      serveUrl: BUNDLE_DIR,
      codec: "h264",
      outputLocation: output,
      inputProps: job.props,
      cancelSignal,
      // Photos, clips and fonts can be slow to load from storage
      timeoutInMilliseconds: 60_000,
      concurrency: RENDER_CONCURRENCY,
      offthreadVideoCacheSizeInBytes: VIDEO_CACHE_BYTES,
    });
  } catch (err) {
    throw timedOut ? new Error("Render took longer than the time limit") : err;
  } finally {
    clearTimeout(timer);
  }

  // Even sound on every platform: level the audio, copy the picture as it is (fast, no re-encode)
  const levelled = join(dir, "levelled.mp4");
  await runFfmpeg(["-i", output, "-c:v", "copy", "-af", LOUDNESS, "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", levelled]);
  await uploadResult(levelled, job.outputKey, "video/mp4");
}
