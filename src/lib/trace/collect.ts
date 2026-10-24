import { emit } from "./core";
import { bodyPreview, cleanUrl, clip, preview } from "./redact";

// What gets recorded for each kind of outside call. Every function here swallows its own errors.

const TEXT_TYPES = /json|text|xml|javascript|csv/i;
const MAX_BODY = 1500;
const MAX_PROMPT = 12_000;
const MAX_REPLY = 8000;

function requestBody(raw: unknown): unknown {
  if (raw == null) return undefined;
  if (typeof raw === "string") return bodyPreview(raw, MAX_BODY);
  if (raw instanceof URLSearchParams) return raw.toString();
  return "[binary or form data]";
}

async function responseBody(res: Response): Promise<{ body: unknown; bytes?: number; json?: Record<string, unknown> }> {
  const type = res.headers.get("content-type") ?? "";
  const length = Number(res.headers.get("content-length")) || undefined;
  if (!TEXT_TYPES.test(type)) return { body: `[${type || "binary"}${length ? `, ${length.toLocaleString("en")} bytes` : ""}]`, bytes: length };
  const text = await res.clone().text();
  let json: Record<string, unknown> | undefined;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON
  }
  return { body: json ? preview(json, { str: MAX_BODY }) : clip(text, MAX_BODY), bytes: text.length, json };
}

/** One vendor HTTP call (every adapter goes through providers/http.ts request()). */
export async function traceHttp(service: string, url: string, init: RequestInit, started: number, res: Response | null, error?: unknown): Promise<void> {
  try {
    const response = res ? await responseBody(res) : null;
    const credits = response?.json && typeof response.json.credits_charged === "number" ? response.json.credits_charged : undefined;
    const creditsLeft = response?.json && typeof response.json.credits_remaining === "number" ? response.json.credits_remaining : undefined;
    emit("http", {
      ts: started,
      ms: Date.now() - started,
      service,
      method: (init.method ?? "GET").toUpperCase(),
      url: cleanUrl(url),
      req: requestBody(init.body),
      status: res?.status,
      res: response?.body,
      bytes: response?.bytes,
      credits,
      creditsLeft,
      error: error instanceof Error ? error.message : error ? String(error) : undefined,
    });
  } catch {
    // best effort
  }
}

type Message = { role: string; content?: unknown };

function promptOf(messages: Message[]) {
  return messages.map((m) => ({
    role: m.role,
    content:
      typeof m.content === "string"
        ? clip(m.content, MAX_PROMPT)
        : Array.isArray(m.content)
          ? m.content.map((part: { type?: string; text?: string; image_url?: { url?: string } }) =>
              part.type === "image_url" ? `[image] ${cleanUrl(part.image_url?.url ?? "")}` : clip(part.text ?? "", MAX_PROMPT)
            )
          : "[content]",
  }));
}

interface LlmFields {
  op: "chat" | "embed";
  model: string;
  started: number;
  messages?: Message[];
  reply?: string;
  inputs?: string[];
  tokensIn?: number;
  tokensOut?: number;
  costUsd?: number;
  error?: unknown;
}

/** One AI call (OpenAI adapter). Embeddings record how many texts were sent, not the vectors. */
export function traceLlm(f: LlmFields): void {
  try {
    emit("llm", {
      ts: f.started,
      ms: Date.now() - f.started,
      service: "OpenAI",
      op: f.op,
      model: f.model,
      prompt: f.messages ? promptOf(f.messages) : undefined,
      reply: f.reply != null ? bodyPreview(f.reply, MAX_REPLY) : undefined,
      inputs: f.inputs?.length,
      sample: f.inputs?.[0] ? clip(f.inputs[0], 300) : undefined,
      chars: f.inputs?.reduce((n, t) => n + t.length, 0),
      tokensIn: f.tokensIn,
      tokensOut: f.tokensOut,
      costUsd: f.costUsd,
      error: f.error instanceof Error ? f.error.message : f.error ? String(f.error) : undefined,
    });
  } catch {
    // best effort
  }
}

/** Database functions that only read, so reports can hide them with the other reads. */
const READ_RPCS = new Set(["match_brand_chunks"]);

function headerValue(init: RequestInit | undefined, name: string): string {
  try {
    return new Headers(init?.headers).get(name) ?? "";
  } catch {
    return "";
  }
}

/** Every Supabase call made with the service-role client: table, operation, filter, data and result. */
export const dbFetch: typeof fetch = async (input, init) => {
  const started = Date.now();
  const res = await fetch(input, init);
  try {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    const method = (init?.method ?? "GET").toUpperCase();
    const rest = url.pathname.match(/\/rest\/v1\/(.+)$/)?.[1];
    const storage = url.pathname.match(/\/storage\/v1\/object\/(.+)$/)?.[1];
    if (!rest && !storage) return res;

    let op: string;
    let table: string;
    if (storage) {
      table = "storage";
      op = method === "DELETE" ? "remove" : method === "GET" ? "read" : "upload";
    } else if (rest!.startsWith("rpc/")) {
      table = rest!.slice(4);
      op = "rpc";
    } else {
      table = rest!;
      const prefer = headerValue(init, "prefer");
      op =
        { GET: "select", HEAD: "count", PATCH: "update", DELETE: "delete" }[method] ??
        (url.searchParams.has("on_conflict") || prefer.includes("merge-duplicates") ? "upsert" : "insert");
    }

    const filter = [...url.searchParams.entries()]
      .filter(([k]) => !["select", "columns", "on_conflict"].includes(k))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const read = op === "select" || op === "count" || op === "read" || (op === "rpc" && READ_RPCS.has(table));

    let sent: unknown;
    if (typeof init?.body === "string") {
      const parsed = bodyPreview(init.body, 300);
      sent = Array.isArray(parsed) ? { rows: parsed.length, first: parsed[0] } : parsed;
    } else if (init?.body) {
      sent = "[file]";
    }

    const range = res.headers.get("content-range");
    const count = range?.includes("/") ? Number(range.split("/")[1]) : undefined;
    let rows: number | undefined;
    let result: unknown;
    if (/json/i.test(res.headers.get("content-type") ?? "")) {
      const text = await res.clone().text();
      try {
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          rows = json.length;
          result = json.length ? { rows: json.length, first: preview(json[0], { str: 300 }) } : { rows: 0 };
        } else {
          result = preview(json, { str: 300 });
        }
      } catch {
        result = clip(text, 300);
      }
    }

    emit("db", {
      ts: started,
      ms: Date.now() - started,
      op,
      table,
      path: storage ? decodeURIComponent(storage) : undefined,
      select: url.searchParams.get("select") ?? undefined,
      filter: filter ? clip(decodeURIComponent(filter), 400) : undefined,
      read,
      status: res.status,
      rows: Number.isFinite(count) ? count : rows,
      sent,
      result,
      error: res.ok
        ? undefined
        : typeof result === "object" && result && "message" in result
          ? String((result as { message: unknown }).message)
          : `HTTP ${res.status}`,
    });
  } catch {
    // best effort
  }
  return res;
};
