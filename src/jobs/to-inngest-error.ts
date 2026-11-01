import { NonRetriableError, RetryAfterError } from "inngest";
import { AppError, userMessage } from "@/core/errors";
import { cleanReason } from "@/core/error-text";

/**
 * Our errors to Inngest's: stop, retry after a wait, or retry. Anything that isn't one of ours is
 * retried with its exact description as the message (a database error's code and details survive).
 */
export function toInngestError(err: unknown): never {
  if (err instanceof AppError) {
    if (!err.retryable) throw new NonRetriableError(err.message);
    if (err.retryAfterMs) throw new RetryAfterError(err.message, err.retryAfterMs);
    throw err;
  }
  throw new Error(userMessage(err), { cause: err });
}

/**
 * Why Inngest gave up, for the screen: the failed step's own message as it is, or a failure of
 * Inngest or the host (a time limit, a result too big to keep) in plain words, keeping their text.
 */
export function failureMessage(error: { name?: string; message?: string } | null | undefined): string {
  const said = cleanReason(error?.message ?? "", 400);
  if (!said) return `It stopped without a message${error?.name ? ` (${error.name})` : ""}.`;
  const match = FAILURES.find(([pattern]) => pattern.test(`${error?.name ?? ""} ${said}`));
  return match ? `${match[1]} ("${said}").` : said;
}

// What Inngest and Vercel record when they, not our code, stop a run (Inngest's server source and
// docs, Vercel's error pages), in plain words. Their own text follows in quotes.
const FAILURES: [RegExp, string][] = [
  [/HTTP 504|FUNCTION_INVOCATION_TIMEOUT|task timed out|function (execution )?timed out/i, "Our server stopped the step: it ran longer than the hosting time limit allows (Vercel: 300 s, or 800 s on Pro)"],
  [/HTTP 413|FUNCTION_PAYLOAD_TOO_LARGE/i, "The data sent between Inngest and our server was too big (Vercel allows 4.5 MB)"],
  [/InngestInvokeTimeoutError|timed out waiting for invoked function/i, "It didn't finish in time, so the research stopped waiting for it"],
  [/step output size|output_too_large|response body exceeds/i, "A step's result was too big to keep between steps (Inngest allows 4 MB)"],
  [/state size limit/i, "The run kept too much data between steps (Inngest allows 32 MB)"],
  [/step limit of \d+ steps/i, "The run had more steps than Inngest allows (1,000)"],
  [/unable to reach (the )?sdk|connection experienced a timeout or was blocked|closed the request before finishing|reset the connection|TLS handshake/i, "Inngest couldn't reach our server"],
  [/Server returned a fatal error|did not come from an Inngest SDK/i, "Our server answered Inngest with an error page instead of a result"],
];
