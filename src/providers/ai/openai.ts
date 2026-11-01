import OpenAI from "openai";
import sharp from "sharp";
import type { z } from "zod";
import { env } from "@/config/env";
import { LIMITS } from "@/config/limits";
import { MODELS } from "@/config/models";
import { tokenCost } from "@/config/pricing";
import { AppError, notConfigured, userMessage, type ErrorType } from "@/core/errors";
import { cleanReason, isPermanentNetworkError, networkReason, quoted, statusText } from "@/core/error-text";
import { parseJson } from "@/lib/json";
import { request, shortUrl } from "@/providers/http";
import type { Result } from "@/providers/usage";
import { trace, traceLlm } from "@/lib/trace";

const SERVICE = "OpenAI";
let client: OpenAI | null = null;

function getClient() {
  if (!env.OPENAI_API_KEY) throw notConfigured(SERVICE, "OPENAI_API_KEY is empty on the server");
  // Inngest is the only retry layer
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: LIMITS.fetchTimeoutMs });
  return client;
}

// OpenAI's documented error codes (developers.openai.com/api/docs/guides/error-codes) in plain words.
// "Out of credit" has had several codes over time; its type stays insufficient_quota.
const KNOWN: Record<string, { say: string; type: ErrorType; retry: boolean }> = {
  insufficient_quota: { say: "OpenAI is out of credit", type: "OUT_OF_CREDIT", retry: false },
  credit_balance_exhausted: { say: "OpenAI is out of credit", type: "OUT_OF_CREDIT", retry: false },
  billing_hard_limit_reached: { say: "OpenAI's spending limit for this account is reached", type: "OUT_OF_CREDIT", retry: false },
  organization_spend_limit_exceeded: { say: "The OpenAI organization's spend limit is reached", type: "OUT_OF_CREDIT", retry: false },
  project_spend_limit_exceeded: { say: "The OpenAI project's spend limit is reached", type: "OUT_OF_CREDIT", retry: false },
  organization_usage_limit_exceeded: { say: "OpenAI's usage limit for this organization is reached", type: "RATE_LIMITED", retry: false },
  invalid_api_key: { say: "OpenAI rejected our API key", type: "NOT_CONFIGURED", retry: false },
  unsupported_country_region_territory: { say: "OpenAI doesn't serve the region our server runs in", type: "NOT_CONFIGURED", retry: false },
  model_not_found: { say: "OpenAI doesn't have this model, or this account isn't allowed to use it", type: "NOT_CONFIGURED", retry: false },
  context_length_exceeded: { say: "The text is too long for OpenAI's model", type: "INVALID_INPUT", retry: false },
  invalid_image_url: { say: "OpenAI couldn't download one of the images", type: "INVALID_INPUT", retry: false },
  image_parse_error: { say: "OpenAI couldn't read one of the images (it takes PNG, JPEG, WEBP or a still GIF)", type: "INVALID_INPUT", retry: false },
  invalid_prompt: { say: "OpenAI's safety check flagged the request", type: "CONTENT_BLOCKED", retry: false },
  slow_down: { say: "OpenAI asked us to slow down", type: "RATE_LIMITED", retry: true },
  server_is_overloaded: { say: "OpenAI is overloaded right now", type: "PROVIDER_DOWN", retry: true },
  service_unavailable_error: { say: "OpenAI is overloaded right now", type: "PROVIDER_DOWN", retry: true },
  server_error: { say: "OpenAI had an internal error", type: "PROVIDER_DOWN", retry: true },
};

/** OpenAI's wait, plus up to 20s, so steps that failed together don't all retry at the same moment and collide again */
const spread = (ms: number) => Math.max(ms, 5_000) + Math.round(Math.random() * 20_000);

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof OpenAI.APIConnectionTimeoutError) {
    return new AppError(`OpenAI didn't answer within ${Math.round(LIMITS.fetchTimeoutMs / 1000)} seconds.`, "TIMEOUT", true);
  }
  if (err instanceof OpenAI.APIConnectionError) {
    const permanent = isPermanentNetworkError(err);
    return new AppError(`Couldn't reach OpenAI: ${networkReason(err)}.`, permanent ? "INVALID_INPUT" : "PROVIDER_DOWN", !permanent);
  }
  if (err instanceof OpenAI.APIError) {
    // OpenAI's own words, without the status the SDK puts in front ("429 Rate limit reached…")
    const said = (err.error as { message?: string } | undefined)?.message ?? err.message;
    const status = err.status ? statusText(err.status) : "no status";
    const tail = ` (${status}${err.code ? `, ${err.code}` : ""})${quoted(said)}.`;
    const known = KNOWN[err.code ?? ""] ?? KNOWN[err.type ?? ""];
    if (known) {
      const wait = known.retry && (err.status === 429 || err.status === 503) ? spread(retryWait(err)) : undefined;
      return new AppError(`${known.say}${tail}`, known.type, known.retry, wait);
    }
    if (/must be verified/i.test(said)) return new AppError(`OpenAI needs the organization verified before it can use this model${tail}`, "NOT_CONFIGURED", false);
    if (err.status === 401) return new AppError(`OpenAI rejected our API key${tail}`, "NOT_CONFIGURED", false);
    if (err.status === 429) return rateLimited(err, tail);
    if (err.status === 403) return new AppError(`OpenAI refused the request${tail}`, "NOT_CONFIGURED", false);
    if (err.status === 404) return new AppError(`OpenAI doesn't have this model or endpoint${tail}`, "NOT_CONFIGURED", false);
    if (err.status && err.status >= 500) return new AppError(`OpenAI had a problem on its side${tail}`, "PROVIDER_DOWN", true);
    if (err.status) return new AppError(`OpenAI didn't accept the request${tail}`, "INVALID_INPUT", false);
  }
  return new AppError(`The OpenAI call failed: ${userMessage(err)}`, "UNKNOWN", true);
}

// A wait longer than this (a daily limit) fails the step now, instead of keeping the client's screen spinning for hours
const MAX_RATE_WAIT_MS = 10 * 60_000;

/** OpenAI's 429s: a per-minute limit clears by itself; a daily limit or a request bigger than the minute's limit doesn't. */
function rateLimited(err: InstanceType<typeof OpenAI.APIError>, tail: string): AppError {
  if (/request too large/i.test(err.message)) {
    return new AppError(`This request is bigger than the OpenAI account's per-minute limit${tail}`, "RATE_LIMITED", false);
  }
  const wait = retryWait(err);
  if (/per day/i.test(err.message) || wait > MAX_RATE_WAIT_MS) {
    return new AppError(`OpenAI's daily limit for this account is used up${tail}`, "RATE_LIMITED", false);
  }
  return new AppError(`OpenAI's per-minute limit was reached${tail}`, "RATE_LIMITED", true, spread(wait));
}

/** How long OpenAI asks us to wait: its retry headers, else "try again in 1m30s" in its message, else a minute. */
function retryWait(err: InstanceType<typeof OpenAI.APIError>): number {
  const ms = Number(err.headers?.get("retry-after-ms"));
  if (ms > 0) return ms;
  const seconds = Number(err.headers?.get("retry-after"));
  if (seconds > 0) return seconds * 1000;
  const said = err.message.match(/try again in ((?:[\d.]+(?:ms|h|m|s))+)/i)?.[1];
  if (!said) return 60_000;
  const unit = { h: 3_600_000, m: 60_000, s: 1000, ms: 1 } as const;
  return [...said.matchAll(/([\d.]+)(ms|h|m|s)/g)].reduce((total, [, n, u]) => total + Number(n) * unit[u as keyof typeof unit], 0);
}

type Message = OpenAI.Chat.ChatCompletionMessageParam;

async function chat(messages: Message[], model: string, json = false): Promise<Result<string>> {
  const started = Date.now();
  try {
    const res = await getClient().chat.completions.create({
      model,
      messages,
      ...(json ? { response_format: { type: "json_object" as const } } : {}),
    });
    const choice = res.choices[0];
    if (choice?.message?.refusal) throw new AppError(`OpenAI declined to answer${quoted(choice.message.refusal)}.`, "CONTENT_BLOCKED", false);
    if (choice?.finish_reason === "content_filter") throw new AppError("OpenAI's content filter stopped the reply part way. Reword the request and try again.", "CONTENT_BLOCKED", false);
    if (choice?.finish_reason === "length") {
      throw new AppError(`OpenAI's reply was cut off: it reached the length limit (${res.usage?.completion_tokens ?? "?"} tokens) before finishing.`, "UNKNOWN", true);
    }
    if (!choice?.message?.content?.trim()) throw new AppError(`OpenAI sent an empty reply (finish reason: ${choice?.finish_reason ?? "none"}).`, "UNKNOWN", true);
    const tokensIn = res.usage?.prompt_tokens ?? 0;
    const tokensOut = res.usage?.completion_tokens ?? 0;
    const costUsd = tokenCost(model, tokensIn, tokensOut);
    const reply = choice?.message?.content ?? "";
    if (trace.enabled) traceLlm({ op: "chat", model, started, messages, reply, tokensIn, tokensOut, costUsd });
    return { data: reply, usage: { provider: "openai", model, tokensIn, tokensOut, costUsd } };
  } catch (err) {
    if (trace.enabled) traceLlm({ op: "chat", model, started, messages, error: err });
    throw toAppError(err);
  }
}

/**
 * Images go to OpenAI inline (downloaded and shrunk by us), not as links it must fetch itself:
 * a slow file host (e.g. an AI provider's temporary files) would otherwise fail the whole call.
 * An image that can't be downloaded is left out; if none can, the call is retried later.
 */
async function inlineImages(urls: string[]): Promise<string[]> {
  if (!urls.length) return [];
  const out = await Promise.all(
    urls.map(async (url) => {
      if (url.startsWith("data:")) return url;
      try {
        const res = await request("The image host", url, {}, 30_000);
        if (!res.ok) return { failed: `${shortUrl(url)} answered ${statusText(res.status)}` };
        const bytes = Buffer.from(await res.arrayBuffer());
        const jpeg = await sharp(bytes)
          .rotate()
          .resize(1280, 1280, { fit: "inside", withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer()
          .catch((err: Error) => {
            throw new AppError(`${shortUrl(url)} isn't an image we can read (${cleanReason(err.message, 120)})`, "INVALID_INPUT", false);
          });
        return `data:image/jpeg;base64,${jpeg.toString("base64")}`;
      } catch (err) {
        return { failed: userMessage(err).replace(/\.$/, "") };
      }
    })
  );
  const images = out.filter((u): u is string => typeof u === "string");
  const failed = out.filter((u): u is { failed: string } => typeof u === "object").map((u) => u.failed);
  if (failed.length) console.warn(`[openai] left out ${failed.length} image(s): ${failed.join("; ")}`);
  if (!images.length) {
    throw new AppError(`Couldn't load any of the ${urls.length} image${urls.length === 1 ? "" : "s"} to look at: ${failed.slice(0, 2).join("; ")}.`, "PROVIDER_DOWN", true);
  }
  return images;
}

function messages(prompt: string, system?: string, images: string[] = []): Message[] {
  const list: Message[] = [];
  if (system) list.push({ role: "system", content: system });
  list.push(
    images.length
      ? { role: "user", content: [{ type: "text", text: prompt }, ...images.map((url) => ({ type: "image_url" as const, image_url: { url } }))] }
      : { role: "user", content: prompt }
  );
  return list;
}

export function text(prompt: string, system?: string): Promise<Result<string>> {
  return chat(messages(prompt, system), MODELS.text);
}

export function vision(prompt: string, imageUrl: string, system?: string): Promise<Result<string>> {
  return inlineImages([imageUrl]).then((images) => chat(messages(prompt, system, images), MODELS.vision));
}

export interface StructuredOptions {
  system?: string;
  /** Public image URLs to look at */
  images?: string[];
  /** Defaults to MODELS.text, or MODELS.vision with images */
  model?: string;
}

/** JSON reply checked against a zod schema. A bad shape is retryable. */
export async function structured<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, prompt: string, opts: StructuredOptions = {}): Promise<Result<T>> {
  const images = opts.images ?? [];
  const model = opts.model ?? (images.length ? MODELS.vision : MODELS.text);
  const res = await chat(messages(prompt, opts.system, await inlineImages(images)), model, true);
  const json = safeParse(res.data);
  if (json === undefined) throw new AppError(`OpenAI's reply wasn't valid JSON: "${cleanReason(res.data, 120)}".`, "UNKNOWN", true);
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const where = issue?.path.join(".") || "(top)";
    const more = parsed.error.issues.length > 1 ? ` (and ${parsed.error.issues.length - 1} more)` : "";
    console.warn(`[ai.structured] reply didn't match the schema at "${where}": ${issue?.message}. Reply starts: ${res.data.slice(0, 300)}`);
    throw new AppError(`OpenAI's reply didn't have the expected shape at "${where}": ${issue?.message}${more}.`, "UNKNOWN", true);
  }
  return { data: parsed.data, usage: res.usage };
}

function safeParse(raw: string): unknown {
  try {
    return parseJson(raw);
  } catch {
    return undefined;
  }
}

export async function embed(inputs: string[]): Promise<Result<number[][]>> {
  const model = MODELS.embed;
  const started = Date.now();
  try {
    const res = await getClient().embeddings.create({ model, input: inputs, dimensions: env.EMBEDDING_DIMENSIONS });
    const tokensIn = res.usage?.prompt_tokens ?? 0;
    const costUsd = tokenCost(model, tokensIn, 0);
    if (trace.enabled) traceLlm({ op: "embed", model, started, inputs, tokensIn, costUsd });
    return { data: res.data.map((d) => d.embedding), usage: { provider: "openai", model, tokensIn, tokensOut: 0, costUsd } };
  } catch (err) {
    if (trace.enabled) traceLlm({ op: "embed", model, started, inputs, error: err });
    throw toAppError(err);
  }
}
