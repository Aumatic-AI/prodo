import { NonRetriableError, RetryAfterError } from "inngest";
import { AppError } from "@/core/errors";

export function toInngestError(err: unknown): never {
  if (err instanceof AppError) {
    if (!err.retryable) throw new NonRetriableError(err.message);
    if (err.retryAfterMs) throw new RetryAfterError(err.message, err.retryAfterMs);
  }
  throw err;
}
