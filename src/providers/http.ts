import { AppError, type ErrorType } from "@/core/errors";
import { cleanReason, isPermanentNetworkError, networkReason, quoted, statusText, vendorDetail, vendorParts } from "@/core/error-text";
import { LIMITS } from "@/config/limits";
import { trace, traceHttp } from "@/lib/trace";

/** "royal-gypsy.com/products/x", for messages */
export function shortUrl(url: string): string {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, "")}${u.pathname === "/" ? "" : u.pathname}`.slice(0, 120);
  } catch {
    return url.slice(0, 120);
  }
}

/** " (reading royal-gypsy.com/x)", or nothing */
const doing = (what?: string) => (what ? ` (${what})` : "");

/** fetch with a time limit. Timeouts and network failures become AppErrors that say exactly what happened. */
export async function request(
  service: string,
  url: string,
  init: RequestInit = {},
  timeoutMs: number = LIMITS.fetchTimeoutMs
): Promise<Response> {
  const started = Date.now();
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (trace.enabled) await traceHttp(service, url, init, started, res);
    return res;
  } catch (err) {
    if (trace.enabled) await traceHttp(service, url, init, started, null, err);
    const where = shortUrl(url);
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new AppError(`${service} didn't answer within ${Math.round(timeoutMs / 1000)} seconds (${where}).`, "TIMEOUT", true);
    }
    const permanent = isPermanentNetworkError(err);
    throw new AppError(`Couldn't reach ${service} (${where}): ${networkReason(err)}.`, permanent ? "INVALID_INPUT" : "PROVIDER_DOWN", !permanent);
  }
}

/**
 * An HTTP error status as an AppError that says who refused, the status, and their own reason.
 * `detail` is the vendor's reason; `what` is what we were doing ("reading royal-gypsy.com/x").
 */
export function statusError(service: string, status: number, detail?: string, retryAfterSec?: number, what?: string): AppError {
  const who = `${service}${doing(what)}`;
  const tail = ` (${statusText(status)})${quoted(detail)}.`;
  if (status === 401) return new AppError(`${who} rejected our API key${tail}`, "NOT_CONFIGURED", false);
  if (status === 403) return new AppError(`${who} refused the request${tail}`, "NOT_CONFIGURED", false);
  if (status === 402) return new AppError(`${who} is out of credit${tail}`, "OUT_OF_CREDIT", false);
  if (status === 429) return new AppError(`${who} says too many requests${tail}`, "RATE_LIMITED", true, (retryAfterSec ?? 30) * 1000);
  if (status === 408 || status === 504 || status === 522 || status === 524) return new AppError(`${who} timed out${tail}`, "TIMEOUT", true);
  if (status >= 500) return new AppError(`${who} had a problem on its side${tail}`, "PROVIDER_DOWN", true);
  if (status === 404 || status === 410) return new AppError(`${who} found nothing there${tail}`, "INVALID_INPUT", false);
  return new AppError(`${who} didn't accept the request${tail}`, "INVALID_INPUT", false);
}

/** A vendor's documented error code in plain words: what happened, and whether trying again can help */
export interface KnownError {
  say: string;
  type: ErrorType;
  retry: boolean;
}
export type KnownErrors = Record<string, KnownError>;

/**
 * The AppError for a vendor's documented code: our plain sentence first, then the status, the code
 * and the vendor's own words. "Twelve Labs (watching a.com/v.mp4): the video is too short to watch
 * (400 Bad Request, video_duration_too_short): "The minimum duration is 4 seconds."."
 */
export function knownError(service: string, known: KnownError, code: string, opts: { status?: number; message?: string; what?: string; retryAfterSec?: number } = {}): AppError {
  const status = opts.status ? `${statusText(opts.status)}, ` : "";
  const wait = known.retry && known.type === "RATE_LIMITED" ? (opts.retryAfterSec ?? 30) * 1000 : undefined;
  return new AppError(`${service}${doing(opts.what)}: ${known.say} (${status}${code})${quoted(opts.message)}.`, known.type, known.retry, wait);
}

/**
 * The error for a failed reply: the vendor's documented code in plain words when it's in `known`
 * (or, for vendors that send only a sentence, when the sentence matches one of `byMessage`), else
 * statusError. A 200 that says it failed ({success: false}) has no status worth showing.
 */
export function replyError(service: string, res: Response, body: unknown, text: string, what?: string, known?: KnownErrors, byMessage: [RegExp, string][] = []): AppError {
  const { message, code } = vendorParts(body, text);
  const retryAfterSec = Number(res.headers.get("retry-after")) || undefined;
  const status = res.ok ? undefined : res.status;
  const key = code && known?.[code] ? code : byMessage.find(([pattern]) => pattern.test(message ?? ""))?.[1];
  if (key && known?.[key]) return knownError(service, known[key], key, { status, message, what, retryAfterSec });
  if (res.ok) return new AppError(`${service}${doing(what)} reported a failure${quoted(vendorDetail(body, text))}.`, "PROVIDER_DOWN", true);
  return statusError(service, res.status, vendorDetail(body, text), retryAfterSec, what);
}

function parseBody(text: string): unknown {
  try {
    return text ? JSON.parse(text) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Reads a JSON body, or throws for non-2xx responses: the vendor's documented code in plain words
 * when it's in `known`, else statusError with their reason, whatever shape it uses. A 2xx reply that
 * isn't JSON is an error too. `detailOf` overrides the reason.
 */
export async function jsonOrThrow<T = any>(
  service: string,
  res: Response,
  detailOf?: (body: any) => string | undefined,
  what?: string,
  known?: KnownErrors
): Promise<T> {
  const text = await res.text().catch(() => "");
  const body = parseBody(text) as any;
  if (!res.ok) {
    if (detailOf) throw statusError(service, res.status, detailOf(body) ?? vendorDetail(body, text), Number(res.headers.get("retry-after")) || undefined, what);
    throw replyError(service, res, body, text, what, known);
  }
  if (text.trim() && body === undefined) {
    throw new AppError(`${service}${doing(what)} sent a reply that isn't JSON: "${cleanReason(text, 120)}".`, "PROVIDER_DOWN", true);
  }
  return body as T;
}
