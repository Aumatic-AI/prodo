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
  | "UNAUTHORIZED"
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

/** A login that isn't linked to a business (one login = one business) */
export const NO_BUSINESS_MESSAGE = "This login isn't linked to a business yet. Ask your admin to check the account.";

export function notConfigured(service: string): AppError {
  return new AppError(`${service} isn't set up correctly. Please contact your admin.`, "NOT_CONFIGURED", false);
}

export function userMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong";
}
