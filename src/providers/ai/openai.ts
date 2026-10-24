import OpenAI from "openai";
import type { z } from "zod";
import { env } from "@/config/env";
import { LIMITS } from "@/config/limits";
import { MODELS } from "@/config/models";
import { tokenCost } from "@/config/pricing";
import { AppError, notConfigured } from "@/core/errors";
import { parseJson } from "@/lib/json";
import type { Result } from "@/providers/usage";
import { trace, traceLlm } from "@/lib/trace";

const SERVICE = "OpenAI";
let client: OpenAI | null = null;

function getClient() {
  if (!env.OPENAI_API_KEY) throw notConfigured(SERVICE);
  // Inngest is the only retry layer
  client ??= new OpenAI({ apiKey: env.OPENAI_API_KEY, maxRetries: 0, timeout: LIMITS.fetchTimeoutMs });
  return client;
}

function toAppError(err: unknown): AppError {
  if (err instanceof AppError) return err;
  if (err instanceof OpenAI.APIError) {
    const code = (err as any).code as string | undefined;
    if (err.status === 401) return notConfigured(SERVICE);
    if (code === "insufficient_quota") return new AppError("OpenAI is out of credit. Please contact your admin.", "OUT_OF_CREDIT", false);
    if (err.status === 429) return new AppError("Busy right now. Try again in a minute.", "RATE_LIMITED", true, 60_000);
    if (code === "context_length_exceeded") return new AppError("This text is too long. Shorten it and try again.", "INVALID_INPUT", false);
    if (err.status === 404) return notConfigured(SERVICE);
    if (err.status && err.status < 500) return new AppError(`OpenAI couldn't accept this: "${err.message}"`, "INVALID_INPUT", false);
  }
  if (err instanceof Error && /timed? ?out/i.test(err.message)) {
    return new AppError("OpenAI took too long to answer. Try again in a few minutes.", "TIMEOUT", true);
  }
  return new AppError("OpenAI isn't responding. Try again in a few minutes.", "PROVIDER_DOWN", true);
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
    if (choice?.finish_reason === "content_filter" || choice?.message?.refusal) {
      throw new AppError("OpenAI declined this idea. Reword it and try again.", "CONTENT_BLOCKED", false);
    }
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
  return chat(messages(prompt, system, [imageUrl]), MODELS.vision);
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
  const res = await chat(messages(prompt, opts.system, images), model, true);
  const parsed = schema.safeParse(safeParse(res.data));
  if (!parsed.success) {
    throw new AppError("Couldn't read the AI reply. Try again.", "UNKNOWN", true);
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
