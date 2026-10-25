import { env } from "@/config/env";
import { AppError, notConfigured } from "@/core/errors";
import { LIMITS } from "@/config/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { request, statusError } from "@/providers/http";
import { upload, urlFor } from "@/providers/storage/supabase-storage";
import type { RenderBackend, RenderJob, RenderStatus } from "../types";

// Upload-Post's hosted FFmpeg API (https://api.upload-post.com/api/uploadposts/ffmpeg), used until our
// own worker is set up. Its rules (checked with real jobs):
// - files are public URLs; the command uses {input} (first file), {input1}, {input2}… and {output}
// - the command may not contain ; | & $ or backticks, so the filter graph goes in as a file
//   (-filter_complex_script); placeholders aren't filled in inside that file
// - so captions are burned in by a second, simple job (-vf subtitles={input1})
// The finished file is downloaded and saved in our storage at the job's outputKey.
// Small working files live under render-jobs/<id>/ and are removed when the job is done.

const SERVICE = "Upload-Post video rendering";
const API = "https://api.upload-post.com/api/uploadposts/ffmpeg";
const FORBIDDEN = /[;|&$`]/;
const BUCKET = "media";

function headers(): Record<string, string> {
  const key = env.UPLOAD_POST_API_KEY;
  if (!key) throw notConfigured(SERVICE);
  return { Authorization: key.startsWith("Apikey ") ? key : `Apikey ${key}` };
}

/** Storage keys become public URLs (the media bucket is public read); URLs stay as they are. */
function publicFile(input: string): string {
  return /^https?:\/\//.test(input) ? input : urlFor(env.NEXT_PUBLIC_SUPABASE_URL, input);
}

/** One argument for a command line: quoted when it has anything a shell would split. */
export function quoteArg(arg: string): string {
  if (/^[A-Za-z0-9_\-./:=+,%{}@[\]]+$/.test(arg)) return arg;
  return `"${arg.replace(/(["\\])/g, "\\$1")}"`;
}

export function toCommand(args: string[]): string {
  // Upload-Post names the first file {input}
  return ["ffmpeg", "-y", ...args.map((a) => quoteArg(a.replace(/\{input0\}/g, "{input}")))].join(" ");
}

const CONTENT_TYPES: Record<string, string> = { mp4: "video/mp4", mp3: "audio/mpeg", png: "image/png" };

async function failure(res: Response): Promise<AppError> {
  const body = await res.json().catch(() => ({}));
  return statusError(SERVICE, res.status, body?.error ?? body?.message ?? body?.detail);
}

async function startJob(files: string[], command: string, ext: string): Promise<string> {
  if (FORBIDDEN.test(command)) throw new AppError("This video command can't be sent to Upload-Post. Try again.", "INVALID_INPUT", false);
  const res = await request(SERVICE, `${API}/jobs/upload`, {
    method: "POST",
    headers: { ...headers(), "Content-Type": "application/json" },
    body: JSON.stringify({ files: files.map(publicFile), full_command: command, output_extension: ext }),
  });
  if (!res.ok) throw await failure(res);
  const data = await res.json().catch(() => ({}));
  if (!data.job_id) throw new AppError("Upload-Post didn't start the video. Try again.", "PROVIDER_DOWN", true);
  return String(data.job_id);
}

type Remote = { state: "running" | "queued" } | { state: "failed"; error: string } | { state: "finished" };

async function remoteStatus(id: string): Promise<Remote> {
  const res = await request(SERVICE, `${API}/jobs/${encodeURIComponent(id)}`, { headers: headers() });
  if (res.status === 404) throw new AppError("Upload-Post lost this video job. Try again.", "UNKNOWN", false);
  if (!res.ok) throw await failure(res);
  const data = await res.json().catch(() => ({ status: "finished" }));
  const state = String(data.status ?? "pending").toLowerCase();
  if (state === "failed" || state === "error") {
    // The useful line of ffmpeg's error is near the end of the traceback
    const lines = String(data.exc_info ?? data.error ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
    return { state: "failed", error: (lines.at(-1) ?? "the render failed").slice(0, 300) };
  }
  if (state === "finished" || state === "completed" || state === "done") return { state: "finished" };
  return { state: state === "pending" || state === "queued" ? "queued" : "running" };
}

/** Saves a finished Upload-Post job's file in our storage. */
async function fetchInto(id: string, key: string): Promise<void> {
  const res = await request(SERVICE, `${API}/jobs/${encodeURIComponent(id)}/download`, { headers: headers(), redirect: "manual" });
  let fileRes: Response;
  const location = res.headers.get("location");
  if (location) fileRes = await request(SERVICE, location, {}, LIMITS.downloadTimeoutMs);
  else if (!res.ok) throw await failure(res);
  else if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    const body = await res.json();
    const url = body.url ?? body.download_url ?? body.file_url;
    if (!url) throw new AppError("Upload-Post finished the video but sent no download link. Try again.", "UNKNOWN", true);
    fileRes = await request(SERVICE, url, {}, LIMITS.downloadTimeoutMs);
  } else fileRes = res;
  if (!fileRes.ok) throw new AppError("Couldn't download the finished video from Upload-Post. Try again.", "PROVIDER_DOWN", true);
  const ext = key.split(".").pop() ?? "mp4";
  await upload(createAdminClient(), key, Buffer.from(await fileRes.arrayBuffer()), CONTENT_TYPES[ext] ?? "application/octet-stream");
}

// ---------- the job's own state (which pass it's on), kept next to its working files ----------

interface JobState {
  folder: string;
  captionsKey: string | null;
  /** Set once the captions pass has started */
  pass2: string | null;
}

const stateKey = (id: string) => `render-jobs/${id}.txt`;

async function readState(id: string): Promise<JobState | null> {
  const { data } = await createAdminClient().storage.from(BUCKET).download(stateKey(id));
  if (!data) return null;
  try {
    return JSON.parse(await data.text()) as JobState;
  } catch {
    return null;
  }
}

async function writeState(id: string, state: JobState): Promise<void> {
  await upload(createAdminClient(), stateKey(id), Buffer.from(JSON.stringify(state), "utf8"), "text/plain");
}

async function cleanup(id: string, state: JobState | null): Promise<void> {
  const db = createAdminClient();
  const keys = [stateKey(id)];
  if (state) keys.push(`${state.folder}/graph.txt`, `${state.folder}/pass1.mp4`);
  await db.storage.from(BUCKET).remove(keys);
}

export const uploadPostBackend: RenderBackend = {
  id: "upload-post",
  captionsInGraph: false,

  async ready() {
    return env.UPLOAD_POST_API_KEY ? { ok: true } : { ok: false, reason: "Videos aren't set up yet: add UPLOAD_POST_API_KEY, or connect our own video renderer." };
  },

  async submit(job: RenderJob) {
    const folder = `render-jobs/${crypto.randomUUID()}`;
    const inputs = [...job.inputs];
    const args = [...job.args];

    // The filter graph uses ';', which Upload-Post doesn't allow in a command: send it as a file
    const at = args.indexOf("-filter_complex");
    if (at >= 0) {
      const graphKey = `${folder}/graph.txt`;
      await upload(createAdminClient(), graphKey, Buffer.from(args[at + 1], "utf8"), "text/plain");
      inputs.push(graphKey);
      args.splice(at, 2, "-filter_complex_script", `{input${inputs.length - 1}}`);
    }
    if (args.some((a) => a.includes("{dir}"))) throw new AppError("This video needs our own renderer. Try again.", "INVALID_INPUT", false);

    const ext = job.outputKey.split(".").pop() || "mp4";
    const id = await startJob(inputs, toCommand(args), ext);
    await writeState(id, { folder, captionsKey: job.captionsKey ?? null, pass2: null });
    return id;
  },

  async status(id: string, outputKey: string): Promise<RenderStatus> {
    const state = await readState(id);

    // Second pass (captions) running
    if (state?.pass2) {
      const r = await remoteStatus(state.pass2);
      if (r.state === "failed") return { status: "failed", error: `Adding the captions failed: ${r.error}` };
      if (r.state !== "finished") return { status: "running" };
      await fetchInto(state.pass2, outputKey);
      await cleanup(id, state);
      return { status: "done", outputKey };
    }

    const r = await remoteStatus(id);
    if (r.state === "failed") return { status: "failed", error: r.error };
    if (r.state !== "finished") return { status: r.state };

    if (state?.captionsKey) {
      // Main video done: keep it as a working file and burn the captions in a second job
      const pass1Key = `${state.folder}/pass1.mp4`;
      await fetchInto(id, pass1Key);
      const pass2 = await startJob(
        [pass1Key, state.captionsKey],
        toCommand(["-i", "{input0}", "-vf", "subtitles={input1}", "-c:v", "libx264", "-preset", "veryfast", "-crf", "21", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", "{output}"]),
        "mp4"
      );
      await writeState(id, { ...state, pass2 });
      return { status: "running" };
    }

    await fetchInto(id, outputKey);
    await cleanup(id, state);
    return { status: "done", outputKey };
  },
};
