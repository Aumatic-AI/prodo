import { AppError } from "@/core/errors";
import { LIMITS } from "@/config/limits";
import { trace, traceHttp } from "@/lib/trace";

/** fetch with a time limit. Network failures and timeouts become retryable AppErrors. */
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
    if (err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new AppError(`${service} took too long to answer. Try again in a few minutes.`, "TIMEOUT", true);
    }
    throw new AppError(`Couldn't reach ${service}. Try again in a few minutes.`, "PROVIDER_DOWN", true);
  }
}

/** Maps an HTTP status to a plain AppError. `detail` is the vendor's own short reason, if any. */
export function statusError(service: string, status: number, detail?: string, retryAfterSec?: number): AppError {
  const reason = detail ? `: "${detail}"` : "";
  if (status === 401 || status === 403) {
    return new AppError(`${service} isn't set up correctly. Please contact your admin.`, "NOT_CONFIGURED", false);
  }
  if (status === 402) {
    return new AppError(`${service} is out of credit. Please contact your admin.`, "OUT_OF_CREDIT", false);
  }
  if (status === 429) {
    return new AppError(`${service} is busy. Try again in a few minutes.`, "RATE_LIMITED", true, (retryAfterSec ?? 30) * 1000);
  }
  if (status >= 500) {
    return new AppError(`${service} isn't responding. Try again in a few minutes.`, "PROVIDER_DOWN", true);
  }
  return new AppError(`${service} couldn't accept this${reason}.`, "INVALID_INPUT", false);
}

/** Reads a JSON body, or throws statusError for non-2xx responses. */
export async function jsonOrThrow<T = any>(service: string, res: Response, detailOf?: (body: any) => string | undefined): Promise<T> {
  const text = await res.text();
  let body: any = undefined;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    const retryAfter = Number(res.headers.get("retry-after")) || undefined;
    throw statusError(service, res.status, detailOf?.(body) ?? body?.message ?? body?.error, retryAfter);
  }
  return body as T;
}
