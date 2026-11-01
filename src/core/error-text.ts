import type { ErrorType } from "./errors";

// Turns any error into one exact, readable line: what failed and why, in the words of whoever
// refused (a vendor, the network, the database), with keys and account ids taken out.

/** Keys, tokens and account ids that must never be shown, even inside a vendor's own message */
const SECRETS: [RegExp, string][] = [
  [/\b(?:sk|pk|rk)[-_](?:proj[-_]|live[-_]|test[-_])?[A-Za-z0-9_-]{12,}/g, "[key]"],
  [/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi, "Bearer [key]"],
  [/([?&](?:key|api_key|apikey|token|access_token|signature|X-Amz-[A-Za-z-]+)=)[^&\s"']+/gi, "$1[hidden]"],
  [/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]*/g, "[token]"],
  [/\b(?:org|user)-[A-Za-z0-9]{12,}\b/g, "[account]"],
  [/\bproj_[A-Za-z0-9]{8,}\b/g, "[project]"],
];

function stringify(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (raw == null) return "";
  try {
    return JSON.stringify(raw);
  } catch {
    return String(raw);
  }
}

/** Someone else's reason, safe to show: plain text on one line, no keys or account ids, at most `max` characters. */
export function cleanReason(raw: unknown, max = 300): string {
  let text = stringify(raw);
  // An HTML error page: its title says the most
  if (/<html|<!doctype/i.test(text)) text = text.match(/<title[^>]*>([^<]*)</i)?.[1] ?? text.replace(/<[^>]+>/g, " ");
  for (const [pattern, replacement] of SECRETS) text = text.replace(pattern, replacement);
  text = text.replace(/\s+/g, " ").trim();
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

/** ` "reason"` ready to append, or nothing when there's no reason */
export const quoted = (reason: unknown, max?: number) => {
  const text = cleanReason(reason, max);
  return text ? `: "${text}"` : "";
};

// ---------- HTTP ----------

const STATUS_TEXT: Record<number, string> = {
  400: "Bad Request",
  401: "Unauthorized",
  402: "Payment Required",
  403: "Forbidden",
  404: "Not Found",
  405: "Method Not Allowed",
  408: "Request Timeout",
  409: "Conflict",
  410: "Gone",
  413: "Content Too Large",
  415: "Unsupported Media Type",
  422: "Unprocessable Content",
  429: "Too Many Requests",
  500: "Internal Server Error",
  502: "Bad Gateway",
  503: "Service Unavailable",
  504: "Gateway Timeout",
  520: "Unknown Error",
  521: "Web Server Is Down",
  522: "Connection Timed Out",
  523: "Origin Is Unreachable",
  524: "A Timeout Occurred",
  525: "SSL Handshake Failed",
  526: "Invalid SSL Certificate",
  530: "Origin DNS Error",
};

/** "404 Not Found" */
export const statusText = (status: number) => `${status}${STATUS_TEXT[status] ? ` ${STATUS_TEXT[status]}` : ""}`;

/**
 * The vendor's own message and error code from an error reply, whatever shape it uses: JSON
 * (`error.message`, `message`, `detail`, `errors[]`…), S3 XML, an HTML page or plain text.
 */
export function vendorParts(body: any, text = ""): { message?: string; code?: string } {
  const pick = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
  const list = (items: unknown, map: (item: any) => string | undefined) =>
    Array.isArray(items) && items.length ? items.map(map).filter(Boolean).join("; ") || undefined : undefined;

  // S3-style XML (R2): <Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>
  const xmlCode = text.match(/<Code>([^<]*)<\/Code>/)?.[1];
  if (body === undefined && xmlCode) return { message: text.match(/<Message>([^<]*)<\/Message>/)?.[1], code: xmlCode };

  const message =
    pick(body?.error?.message) ??
    pick(body?.error) ??
    pick(body?.message) ??
    pick(body?.detail?.message) ??
    pick(body?.detail) ??
    list(body?.detail, (d) => [Array.isArray(d?.loc) ? d.loc.join(".") : undefined, pick(d?.msg)].filter(Boolean).join(": ")) ??
    list(body?.errors, (e) => pick(e?.message) ?? pick(e)) ??
    pick(body?.msg) ??
    pick(body?.failMsg) ??
    pick(body?.error_description);
  // ElevenLabs moved from detail.status to detail.code; keep both
  const code = pick(body?.error?.code) ?? pick(body?.code) ?? pick(body?.detail?.code) ?? pick(body?.detail?.status) ?? pick(body?.error?.type);
  const extra = pick(body?.details) ?? list(body?.details, (d) => pick(d?.message) ?? pick(d));
  const full = message && extra && !message.includes(extra) ? `${message} (${extra})` : message;
  return { message: full ?? (body === undefined ? pick(text) : undefined), code };
}

/** The vendor's reason as one line: "No credits [credit_balance_exhausted]" */
export function vendorDetail(body: any, text = ""): string | undefined {
  const { message, code } = vendorParts(body, text);
  if (message) return code && !message.includes(code) ? `${message} [${code}]` : message;
  return code;
}

// ---------- Network ----------

const NETWORK_CODES: Record<string, string> = {
  ENOTFOUND: "the address doesn't exist (DNS lookup found nothing)",
  EAI_AGAIN: "the DNS lookup failed for now",
  ECONNREFUSED: "the server refused the connection",
  ECONNRESET: "the connection was dropped",
  EPIPE: "the connection was dropped",
  ETIMEDOUT: "connecting timed out",
  EHOSTUNREACH: "the server can't be reached from here",
  ENETUNREACH: "the network can't be reached",
  UND_ERR_CONNECT_TIMEOUT: "connecting timed out",
  UND_ERR_HEADERS_TIMEOUT: "the server took the request but sent no answer in time",
  UND_ERR_BODY_TIMEOUT: "the answer stopped arriving part way",
  UND_ERR_SOCKET: "the connection was closed unexpectedly",
  CERT_HAS_EXPIRED: "its security certificate has expired",
  DEPTH_ZERO_SELF_SIGNED_CERT: "its security certificate is self-signed",
  SELF_SIGNED_CERT_IN_CHAIN: "its security certificate isn't trusted",
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: "its security certificate can't be verified",
  ERR_TLS_CERT_ALTNAME_INVALID: "its security certificate is for a different address",
  ERR_SSL_WRONG_VERSION_NUMBER: "the secure connection failed (wrong TLS version)",
};

// Asking again won't change these: the address is wrong or the site's certificate is broken
const PERMANENT_NETWORK = new Set(["ENOTFOUND", "CERT_HAS_EXPIRED", "DEPTH_ZERO_SELF_SIGNED_CERT", "SELF_SIGNED_CERT_IN_CHAIN", "UNABLE_TO_VERIFY_LEAF_SIGNATURE", "ERR_TLS_CERT_ALTNAME_INVALID"]);

/** The system code behind a failed request ("ECONNRESET"); fetch keeps it in `cause`, sometimes one level deeper. */
function networkCode(err: unknown): string | undefined {
  const e = err as any;
  for (const c of [e?.cause, e?.cause?.cause, e?.cause?.errors?.[0], e]) {
    if (typeof c?.code === "string") return c.code;
  }
  return undefined;
}

/** Why a request never got an answer: "the connection was dropped (ECONNRESET)". */
export function networkReason(err: unknown): string {
  const code = networkCode(err);
  if (code && NETWORK_CODES[code]) return `${NETWORK_CODES[code]} (${code})`;
  const e = err as any;
  const detail = cleanReason(e?.cause?.message || e?.message || "", 160);
  if (code) return `${detail || "network error"} (${code})`;
  return detail || "network error";
}

export const isPermanentNetworkError = (err: unknown) => PERMANENT_NETWORK.has(networkCode(err) ?? "");

/** fetch's own failure ("TypeError: fetch failed"), not an HTTP error status */
export const isNetworkError = (err: unknown) => err instanceof TypeError && /fetch failed|network/i.test(err.message);

// ---------- Database (Supabase / Postgres) ----------

interface DbErrorLike {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

// Postgres SQLSTATE codes (postgresql.org/docs/current/errcodes-appendix.html) and PostgREST's own
// (docs.postgrest.org/en/latest/references/errors.html) in plain words
const DB_CODES: Record<string, string> = {
  "23505": "a row like this already exists",
  "23503": "it points at a row that doesn't exist, or the row is still used elsewhere",
  "23502": "a required value is missing",
  "23514": "a value isn't allowed by the table's rules",
  "22P02": "a value has the wrong format",
  "22001": "a value is too long",
  "42501": "the database refused access to this row",
  "42P01": "a table is missing (a migration hasn't been applied)",
  "42703": "a column is missing (a migration hasn't been applied)",
  "42883": "a database function is missing (a migration hasn't been applied)",
  "57014": "the query took too long and was stopped",
  "53300": "the database has too many connections open",
  "40001": "two changes clashed; trying again usually works",
  "40P01": "two changes waited on each other (deadlock); trying again usually works",
  P0001: "our own database rule stopped it",
  PGRST000: "the database can't be reached",
  PGRST001: "the database can't be reached",
  PGRST002: "the database is still starting up",
  PGRST003: "the database is busy: no connection came free in time",
  PGRST100: "the query was malformed",
  PGRST102: "the data sent was malformed",
  PGRST103: "the requested range of rows is invalid",
  PGRST116: "expected one row but found none or several",
  PGRST200: "the database doesn't know how these tables link (a migration hasn't been applied)",
  PGRST202: "the database doesn't know this function (a migration hasn't been applied)",
  PGRST204: "the database doesn't know this column (a migration hasn't been applied)",
  PGRST205: "the database doesn't know this table (a migration hasn't been applied)",
  PGRST301: "the database refused our login token",
  PGRST302: "the request had no login token",
  PGRST303: "the login token has expired or isn't valid",
};

/** Connection failures share a class: 08000, 08001, 08006… */
const dbCodeMeaning = (code: string) => DB_CODES[code] ?? (code.startsWith("08") ? "the connection to the database failed" : undefined);

/** Supabase errors are objects with a code and details, not always Error instances */
export function isDbError(err: unknown): err is DbErrorLike {
  const e = err as any;
  return !!e && typeof e === "object" && typeof e.message === "string" && typeof e.code === "string" && ("details" in e || "hint" in e);
}

export function databaseMessage(err: DbErrorLike): string {
  // The database couldn't be reached at all: supabase-js reports fetch's failure as "TypeError: fetch failed",
  // with the cause (ECONNRESET, ENOTFOUND…) in details and "Request was aborted" in hint for a timeout
  if (!err.code && /aborted/i.test(err.hint ?? "")) return `The database didn't answer in time${quoted(err.hint)}.`;
  if (!err.code && /fetch|network/i.test(err.message)) return `Couldn't reach the database${quoted(err.details || err.message)}.`;
  const plain = err.code ? dbCodeMeaning(err.code) : undefined;
  const words = cleanReason([err.message, err.details, err.hint].filter(Boolean).join(" · "));
  return `Database error${plain ? `: ${plain}` : ""} (${err.code || "no code"})${words ? `: "${words}"` : ""}.`;
}

/**
 * Whether trying again can fix a database error: yes for a busy, slow or dropped connection; no for
 * a broken rule (duplicate, missing link, bad value) or a missing table or column (a migration).
 */
function dbErrorKind(code: string): { type: ErrorType; retryable: boolean } {
  const busy = ["", "40001", "40P01", "53300", "57014", "PGRST000", "PGRST001", "PGRST002", "PGRST003"];
  if (busy.includes(code) || code.startsWith("08")) return { type: "PROVIDER_DOWN", retryable: true };
  // Our setup is wrong (a migration not applied, a bad server key): every call fails until it's fixed
  if (["42P01", "42703", "42883"].includes(code) || /^PGRST(2\d\d|30\d)$/.test(code)) return { type: "NOT_CONFIGURED", retryable: false };
  if (/^(2[23]|42|P0)/.test(code) || /^PGRST1\d\d$/.test(code)) return { type: "INVALID_INPUT", retryable: false };
  return { type: "PROVIDER_DOWN", retryable: true };
}

// ---------- Anything else ----------

const CODE_BUGS = new Set(["TypeError", "RangeError", "ReferenceError", "SyntaxError"]);

/**
 * The type of an error that isn't one of ours, and whether trying again can fix it. A bug in our code
 * or data in the wrong shape fails the same way every time; a dropped connection may not.
 */
export function errorKind(err: unknown): { type: ErrorType; retryable: boolean } {
  if (isDbError(err)) return dbErrorKind(err.code ?? "");
  if (isNetworkError(err)) return isPermanentNetworkError(err) ? { type: "INVALID_INPUT", retryable: false } : { type: "PROVIDER_DOWN", retryable: true };
  if (err instanceof Error) {
    if (err.name === "ZodError") return { type: "UNKNOWN", retryable: false };
    // Someone else's reply that wasn't JSON may be fine next time
    if (err instanceof SyntaxError && /JSON/i.test(err.message)) return { type: "UNKNOWN", retryable: true };
    if (CODE_BUGS.has(err.name)) return { type: "UNKNOWN", retryable: false };
  }
  return { type: "UNKNOWN", retryable: true };
}

/** One exact line for any error that isn't already one of ours. */
export function describeError(err: unknown): string {
  if (isDbError(err)) return databaseMessage(err);
  if (isNetworkError(err)) return `Network error: ${networkReason(err)}.`;
  if (err instanceof Error) {
    const issues = (err as any).issues;
    if (err.name === "ZodError" && Array.isArray(issues) && issues.length) {
      const first = issues[0];
      const more = issues.length > 1 ? ` (and ${issues.length - 1} more)` : "";
      return `Unexpected data at "${first.path?.join(".") || "(top)"}": ${first.message}${more}.`;
    }
    if (err instanceof SyntaxError && /JSON/i.test(err.message)) return `Couldn't read a reply as JSON: ${cleanReason(err.message)}.`;
    const message = cleanReason(err.message);
    // A mistake in our own code: say so, with JavaScript's own words
    if (CODE_BUGS.has(err.name)) return `Internal error (${err.name}): ${message || "no details"}.`;
    return message || `${err.name} (no message)`;
  }
  if (typeof err === "string" && err.trim()) return cleanReason(err);
  const message = (err as any)?.message;
  if (typeof message === "string" && message.trim()) return cleanReason(message);
  return `Unexpected error: ${cleanReason(err) || "no details"}.`;
}
