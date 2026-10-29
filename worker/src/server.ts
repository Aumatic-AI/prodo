// Prodo video worker. Makes videos for Prodo and saves them to Supabase storage.
//   GET  /health        -> { ok, ffmpeg: { running, queued }, render: { running, queued } }
//   POST /jobs          -> { jobId }   an ffmpeg job (needs x-worker-secret)
//   POST /render        -> { jobId }   a Remotion template render (needs x-worker-secret)
//   GET  /jobs/:id      -> { status, outputKey?, error? }   either kind (needs x-worker-secret)

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { timingSafeEqual } from "node:crypto";
import { PORT, SECRET } from "./config.ts";
import { addJob, jobStatus, load } from "./jobs.ts";
import { isAllowedUrl, isStorageKey } from "./storage.ts";
import { assertSafeProps } from "./render.ts";
import type { FfmpegInput } from "./ffmpeg.ts";
import type { RenderInput } from "./render.ts";

const TEMPLATE_ID = /^[a-z0-9-]{1,64}$/;

// ---------- checking requests ----------

function parseFfmpeg(body: any): FfmpegInput {
  const { inputs, args, outputKey, contentType } = body ?? {};
  if (!Array.isArray(inputs) || !inputs.every((i) => typeof i === "string")) throw new Error("inputs must be a list of strings");
  if (!Array.isArray(args) || !args.every((a) => typeof a === "string")) throw new Error("args must be a list of strings");
  if (typeof outputKey !== "string" || !isStorageKey(outputKey)) throw new Error("outputKey is not a valid storage key");
  for (const input of inputs) {
    if (!isStorageKey(input) && !isAllowedUrl(input)) throw new Error(`Input not allowed: ${input}`);
  }
  return { inputs, args, outputKey, contentType: typeof contentType === "string" ? contentType : "video/mp4" };
}

function parseRender(body: any): RenderInput {
  const { template, props, outputKey } = body ?? {};
  if (typeof template !== "string" || !TEMPLATE_ID.test(template)) throw new Error("template must be a template id like check-9x16");
  if (!props || typeof props !== "object" || Array.isArray(props)) throw new Error("props must be an object");
  if (typeof outputKey !== "string" || !isStorageKey(outputKey)) throw new Error("outputKey is not a valid storage key");
  assertSafeProps(props);
  return { template, props, outputKey };
}

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

  if (req.method === "GET" && path === "/health") return send(res, 200, { ok: true, ...load() });
  if (!authorized(req)) return send(res, 401, { error: "Unauthorized" });

  if (req.method === "POST" && (path === "/jobs" || path === "/render")) {
    try {
      const body = await readBody(req);
      const jobId = path === "/jobs" ? addJob({ kind: "ffmpeg", input: parseFfmpeg(body) }) : addJob({ kind: "render", input: parseRender(body) });
      return send(res, 202, { jobId });
    } catch (err) {
      return send(res, 400, { error: err instanceof Error ? err.message : "Bad request" });
    }
  }

  const match = path.match(/^\/jobs\/([\w-]+)$/);
  if (req.method === "GET" && match) {
    const status = jobStatus(match[1]);
    return status ? send(res, 200, status) : send(res, 404, { error: "Job not found" });
  }

  return send(res, 404, { error: "Not found" });
}).listen(PORT, () => console.log(`video worker listening on :${PORT}`));
