// Remotion renders: a template (a composition in ../remotion) filled with data (props) becomes an MP4.
// The templates are bundled once at build time; each render opens them in a headless browser.

import { join } from "node:path";
import { makeCancelSignal, renderMedia, selectComposition } from "@remotion/renderer";
import { BUNDLE_DIR, JOB_TIMEOUT_MS } from "./config.ts";
import { isAllowedUrl, uploadResult } from "./storage.ts";

export interface RenderInput {
  /** Composition id, e.g. "check-9x16" */
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
      // Photos and clips can be slow to load from storage
      timeoutInMilliseconds: 60_000,
    });
  } catch (err) {
    throw timedOut ? new Error("Render took longer than the time limit") : err;
  } finally {
    clearTimeout(timer);
  }

  await uploadResult(output, job.outputKey, "video/mp4");
}
