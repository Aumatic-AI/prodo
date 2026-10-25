// Keeps trace files safe and small: secrets removed, long values cut, vectors summarised.

const SECRET_ENV = /KEY|SECRET|TOKEN|PASSWORD/i;
const SECRET_PARAM = /key|token|secret|password|signature|authorization|credential/i;

let secrets: string[] | null = null;

/** Values of secret environment variables, so they can't end up in a trace even by accident. */
function secretValues(): string[] {
  secrets ??= Object.entries(process.env)
    .filter(([name, value]) => SECRET_ENV.test(name) && value && value.length >= 12)
    .map(([, value]) => value as string);
  return secrets;
}

export function scrub(text: string): string {
  return secretValues().reduce((out, secret) => out.split(secret).join("[redacted]"), text);
}

export function clip(text: string, max: number): string {
  return text.length > max ? `${text.slice(0, max)}… [+${(text.length - max).toLocaleString("en")} more characters]` : text;
}

/** A URL with secret-looking query parameters hidden. */
export function cleanUrl(raw: string): string {
  try {
    const url = new URL(raw);
    for (const name of [...url.searchParams.keys()]) {
      if (SECRET_PARAM.test(name)) url.searchParams.set(name, "[redacted]");
    }
    return url.toString();
  } catch {
    return raw;
  }
}

interface PreviewOptions {
  /** Longest string kept in full */
  str?: number;
  /** Most array items kept */
  items?: number;
}

/** A readable copy of any value: long strings cut, long arrays shortened, embeddings replaced by a note. */
export function preview(value: unknown, options: PreviewOptions = {}, depth = 0): unknown {
  const str = options.str ?? 600;
  const items = options.items ?? 20;
  if (typeof value === "string") return clip(value, str);
  if (value === null || typeof value !== "object") return value;
  if (depth >= 7) return "…";
  if (Array.isArray(value)) {
    if (value.length > 32 && value.every((n) => typeof n === "number")) return `[${value.length} numbers]`;
    const head = value.slice(0, items).map((v) => preview(v, options, depth + 1));
    return value.length > items ? [...head, `… +${value.length - items} more`] : head;
  }
  return Object.fromEntries(Object.entries(value).map(([key, v]) => [key, key === "embedding" ? "[vector]" : preview(v, options, depth + 1)]));
}

/** Request or response text as parsed JSON when possible, otherwise as cut text. */
export function bodyPreview(raw: string, str: number): unknown {
  try {
    return preview(JSON.parse(raw), { str });
  } catch {
    return clip(raw, str);
  }
}
