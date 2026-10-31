// Settings from the environment (.env on the VPS). The worker refuses to start without the required ones.

import { fileURLToPath } from "node:url";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const PORT = Number(process.env.PORT ?? 8080);
export const SECRET = required("WORKER_SECRET");
// Cloudflare R2, where Prodo keeps its files (an API token with read and write on the bucket)
export const R2_ENDPOINT = required("R2_ENDPOINT").replace(/\/$/, "");
export const R2_ACCESS_KEY_ID = required("R2_ACCESS_KEY_ID");
export const R2_SECRET_ACCESS_KEY = required("R2_SECRET_ACCESS_KEY");
export const R2_BUCKET = required("R2_BUCKET");
/** The bucket's public address (NEXT_PUBLIC_MEDIA_URL in the app): templates may load files from it */
export const R2_PUBLIC_URL = required("R2_PUBLIC_URL").replace(/\/$/, "");

/** ffmpeg jobs at a time (light) */
export const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT ?? 2);
/** Remotion renders at a time (heavy: each one runs a browser) */
export const MAX_RENDERS = Number(process.env.MAX_RENDERS ?? 1);
export const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS ?? 10 * 60_000);
/** Browser tabs one render uses (default: half the CPU threads); lower it if renders get killed for memory */
export const RENDER_CONCURRENCY = process.env.RENDER_CONCURRENCY ? Number(process.env.RENDER_CONCURRENCY) : null;
/** Cap on decoded video frames kept in memory per render (Remotion's default can reach half the RAM) */
export const VIDEO_CACHE_BYTES = Number(process.env.VIDEO_CACHE_MB ?? 512) * 1024 * 1024;
export const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
export const KEEP_FINISHED_MS = 60 * 60_000;

/** The templates, bundled at build time by scripts/build.ts */
export const BUNDLE_DIR = process.env.BUNDLE_DIR ?? fileURLToPath(new URL("../bundle", import.meta.url));

// Extra hosts allowed as inputs besides our own storage (e.g. Kie result hosts)
export const ALLOWED_HOSTS = (process.env.ALLOWED_INPUT_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
