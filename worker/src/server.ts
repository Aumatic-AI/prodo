// Prodo FFmpeg worker. Runs ffmpeg jobs and uploads results to Supabase storage.
//   GET  /health        -> { ok, running, queued }
//   POST /jobs          -> { jobId }   (needs x-worker-secret)
//   GET  /jobs/:id      -> { status, outputKey?, error? }   (needs x-worker-secret)
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { extname, join } from "node:path";
import { randomUUID, timingSafeEqual } from "node:crypto";

const PORT = Number(process.env.PORT ?? 8080);
const SECRET = required("WORKER_SECRET");
const SUPABASE_URL = required("SUPABASE_URL").replace(/\/$/, "");
const SERVICE_KEY = required("SUPABASE_SERVICE_ROLE_KEY");
const BUCKET = process.env.STORAGE_BUCKET ?? "media";
const MAX_CONCURRENT = Number(process.env.MAX_CONCURRENT ?? 2);
const JOB_TIMEOUT_MS = Number(process.env.JOB_TIMEOUT_MS ?? 10 * 60_000);
const DOWNLOAD_TIMEOUT_MS = 5 * 60_000;
const KEEP_FINISHED_MS = 60 * 60_000;
// Extra hosts allowed as inputs besides our Supabase project (e.g. Kie result hosts)
const ALLOWED_HOSTS = (process.env.ALLOWED_INPUT_HOSTS ?? "").split(",").map((h) => h.trim().toLowerCase()).filter(Boolean);

type Status = "queued" | "running" | "done" | "failed";

interface JobInput {
  inputs: string[];
  args: string[];
  outputKey: string;
  contentType: string;
}

interface Job extends JobInput {
  id: string;
  status: Status;
  error?: string;
  finishedAt?: number;
}

const jobs = new Map<string, Job>();
const queue: Job[] = [];
let running = 0;

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

// ---------- validation ----------

const KEY_PATTERN = /^[A-Za-z0-9_\-./]+$/;

function isStorageKey(value: string): boolean {
  return KEY_PATTERN.test(value) && !value.includes("..") && !value.startsWith("/");
}

function isAllowedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === new URL(SUPABASE_URL).hostname) return true;
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function parseJob(body: any): JobInput {
  const { inputs, args, outputKey, contentType } = body ?? {};
  if (!Array.isArray(inputs) || !inputs.every((i) => typeof i === "string")) throw new Error("inputs must be a list of strings");
  if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) throw new Error("args must be a list of strings");
  if (typeof outputKey !== "string" || !isStorageKey(outputKey)) throw new Error("outputKey is not a valid storage key");
  for (const input of inputs) {
    if (!isStorageKey(input) && !isAllowedUrl(input)) throw new Error(`Input not allowed: ${input}`);
  }
  return { inputs, args, outputKey, contentType: typeof contentType === "string" ? contentType : "video/mp4" };
}

// ---------- storage ----------

function storageHeaders(): Record<string, string> {
  // New sb_secret_ keys go only in apikey; legacy JWT keys also as Bearer
  return SERVICE_KEY.startsWith("sb_") ? { apikey: SERVICE_KEY } : { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
}

async function download(input: string, path: string): Promise<void> {
  const fromStorage = isStorageKey(input);
  const url = fromStorage ? `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${input}` : input;
  const res = await fetch(url, { headers: fromStorage ? storageHeaders() : {}, signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${fromStorage ? input : new URL(input).hostname}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

async function uploadResult(path: string, key: string, contentType: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: "POST",
    headers: { ...storageHeaders(), "Content-Type": contentType, "x-upsert": "true" },
    body: await readFile(path),
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}

// ---------- ffmpeg ----------

/** Runs ffmpeg with an argument list (never a shell string). */
function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => (stderr = (stderr + chunk).slice(-2000)));
    const timer = setTimeout(() => proc.kill("SIGKILL"), JOB_TIMEOUT_MS);
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(signal === "SIGKILL" ? "Render took longer than the time limit" : stderr.trim() || `ffmpeg exited with ${code}`));
    });
  });
}

async function runJob(job: Job): Promise<void> {
  const dir = await mkdtemp(join(tmpdir(), "prodo-"));
  try {
    const localInputs = await Promise.all(
      job.inputs.map(async (input, i) => {
        const ext = extname(isStorageKey(input) ? input : new URL(input).pathname) || ".bin";
        const path = join(dir, `input${i}${ext}`);
        await download(input, path);
        return path;
      })
    );
    const output = join(dir, `output${extname(job.outputKey) || ".mp4"}`);

    // {input0}…{inputN} and {output} become local file paths
    const args = job.args.map((arg) =>
      arg.replace(/\{input(\d+)\}/g, (_, n) => localInputs[Number(n)] ?? "").replace(/\{output\}/g, output)
    );

    await runFfmpeg(args);
    await uploadResult(output, job.outputKey, job.contentType);
    job.status = "done";
  } catch (err) {
    job.status = "failed";
    job.error = err instanceof Error ? err.message : String(err);
  } finally {
    job.finishedAt = Date.now();
    await rm(dir, { recursive: true, force: true });
  }
}

function pump(): void {
  while (running < MAX_CONCURRENT && queue.length) {
    const job = queue.shift()!;
    job.status = "running";
    running++;
    runJob(job).finally(() => {
      running--;
      pump();
    });
  }
}

// Forget finished jobs after an hour
setInterval(() => {
  const cutoff = Date.now() - KEEP_FINISHED_MS;
  for (const [id, job] of jobs) if (job.finishedAt && job.finishedAt < cutoff) jobs.delete(id);
}, 5 * 60_000).unref();

// ---------- http ----------

function send(res: ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
}

function authorized(req: IncomingMessage): boolean {
  const given = Buffer.from(String(req.headers["x-worker-secret"] ?? ""));
  const expected = Buffer.from(SECRET);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

async function readBody(req: IncomingMessage, limit = 1_000_000): Promise<any> {
  let size = 0;
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new Error("Request body too large");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

createServer(async (req, res) => {
  const path = new URL(req.url ?? "/", "http://worker").pathname;

  if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true, running, queued: queue.length });
  if (!authorized(req)) return send(res, 401, { error: "Unauthorized" });

  if (req.method === "POST" && path === "/jobs") {
    try {
      const job: Job = { ...parseJob(await readBody(req)), id: randomUUID(), status: "queued" };
      jobs.set(job.id, job);
      queue.push(job);
      pump();
      return send(res, 202, { jobId: job.id });
    } catch (err) {
      return send(res, 400, { error: err instanceof Error ? err.message : "Bad request" });
    }
  }

  const match = path.match(/^\/jobs\/([\w-]+)$/);
  if (req.method === "GET" && match) {
    const job = jobs.get(match[1]);
    if (!job) return send(res, 404, { error: "Job not found" });
    return send(res, 200, { status: job.status, outputKey: job.status === "done" ? job.outputKey : undefined, error: job.error });
  }

  return send(res, 404, { error: "Not found" });
}).listen(PORT, () => console.log(`ffmpeg worker listening on :${PORT}`));
