export type ErrorType =
  | "PROVIDER_DOWN"
  | "RATE_LIMITED"
  | "OUT_OF_CREDIT"
  | "CONTENT_BLOCKED"
  | "ACCOUNT_DISCONNECTED"
  | "INVALID_INPUT"
  | "TIMEOUT"
  | "UNKNOWN";

export class AppError extends Error {
  constructor(
    message: string,
    public type: ErrorType,
    public retryable: boolean,
    public retryAfterMs?: number
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function userMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
