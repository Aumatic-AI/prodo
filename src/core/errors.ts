import { describeError, errorKind } from "./error-text";

export type ErrorType =
  | "PROVIDER_DOWN"
  | "RATE_LIMITED"
  | "OUT_OF_CREDIT"
  /** A daily or usage cap on the account: waiting minutes won't help */
  | "LIMIT_REACHED"
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

/** `reason` says what exactly is wrong; by default the service's key or settings are missing on the server. */
export function notConfigured(service: string, reason = "its API key or settings are missing on the server"): AppError {
  return new AppError(`${service} isn't set up: ${reason}.`, "NOT_CONFIGURED", false);
}

// Inngest keeps only an error's message between tries and steps (not our type), so the type rides
// along in it: "[[OUT_OF_CREDIT]] OpenAI is out of credit…". classify() reads it back; userMessage()
// and failureMessage() take it off before anything is shown.
const TAG = /^\[\[([A-Z_]+)\]\] /;
export const untag = (message: string) => message.replace(TAG, "");
export const tagType = (type: ErrorType, message: string) => `[[${type}]] ${untag(message)}`;

// Retrying can't fix these: the same call fails the same way until someone changes something
const PERMANENT = new Set<ErrorType>(["OUT_OF_CREDIT", "LIMIT_REACHED", "NOT_CONFIGURED", "BUDGET_REACHED", "PAUSED", "INVALID_INPUT", "CONTENT_BLOCKED", "ACCOUNT_DISCONNECTED", "UNAUTHORIZED"]);

/** The type of any error (ours, one Inngest passed back, the database's, a bug's) and whether trying again can fix it */
export function classify(err: unknown): { type: ErrorType; retryable: boolean; retryAfterMs?: number } {
  if (err instanceof AppError) return { type: err.type, retryable: err.retryable, retryAfterMs: err.retryAfterMs };
  const tagged = err instanceof Error ? (err.message.match(TAG)?.[1] as ErrorType | undefined) : undefined;
  if (tagged) return { type: tagged, retryable: !PERMANENT.has(tagged) };
  return errorKind(err);
}

/**
 * About the whole account, not one page or one photo: no credit, a wrong key or setting, a daily cap,
 * the budget or the pause switch. Every later call fails the same way, so the agent stops at once.
 */
const ACCOUNT_WIDE = new Set<ErrorType>(["OUT_OF_CREDIT", "LIMIT_REACHED", "NOT_CONFIGURED", "BUDGET_REACHED", "PAUSED"]);
export const isAccountWide = (err: unknown) => ACCOUNT_WIDE.has(classify(err).type);

/** The exact message for any error: ours as written, anyone else's described by describeError. */
export function userMessage(err: unknown): string {
  if (err instanceof AppError) return err.message;
  if (err instanceof Error && TAG.test(err.message)) return untag(err.message);
  return describeError(err);
}
