// Settings from the environment (.env on the VPS). The worker refuses to start without the required ones.

import { fileURLToPath } from "node:url";

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

export const PORT = Number(process.env.PORT ?? 8080);
export const SECRET = required("WORKER_SECRET");
export const SUPABASE_URL = required("SUPABASE_URL").replace(/\/$/, "");
export const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
export const BUCKET = process.env.STORAGE_BUCKET ?? "media";

/** ffmpeg jobs at a time (light) */
export const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT ?? 2);
/** Remotion renders at a time (heavy: each one runs a browser) */
export const MAX_RENDERS = Number(process.env.MAX_RENDERS ?? 1);
export const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS ?? 10 * 60_000);
export const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
export const KEEP_FINISHED_MS = 60 * 60_000;

/** The templates, bundled at build time by scripts/build.ts */
export const BUNDLE_DIR = process.env.BUNDLE_DIR ?? fileURLToPath(new URL("../bundle", import.meta.url));

// Extra hosts allowed as inputs besides our Supabase project (e.g. Kie result hosts)
export const ALLOWED_HOSTS = (process.env.ALLOWED_INPUT_HOSTS ?? "")
  .split(",")
  .map((h) => h.trim().toLowerCase())
  .filter(Boolean);
