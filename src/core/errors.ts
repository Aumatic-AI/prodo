export type ErrorType =
  | "PROVIDER_DOWN"
  | "RATE_LIMITED"
  | "OUT_OF_CREDIT"
  | "CONTENT_BLOCKED"
  | "ACCOUNT_DISCONNECTED"
  | "INVALID_INPUT"
  | "NOT_CONFIGURED"
  | "BUDGET_REACHED"
  | "PAUSED"
  | "TIMEOUT"
  | "UNKNOWN";

export class AppError extends Error {
  /** Per-field messages for forms, keyed by path like "products.0.name" */
  fields?: Record<string, string>;

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

export function notConfigured(service: string): AppError {
  return new AppError(`${service} isn't set up correctly. Please contact your admin.`, "NOT_CONFIGURED", false);
}

export function userMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
