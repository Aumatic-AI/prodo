// Text cut at a fixed length (a caption, a page) can end on half of an emoji: a lone UTF-16 surrogate. That
// isn't valid JSON for Inngest, which then can't save the step ("error transforming request with JCS: Missing
// surrogate"), nor for Postgres jsonb.

const LONE_SURROGATE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

/** The same value with every half emoji removed from its strings (plain objects and arrays, all the way down). */
export function wellFormed<T>(value: T): T {
  if (typeof value === "string") return value.replace(LONE_SURROGATE, "") as T;
  if (Array.isArray(value)) return value.map(wellFormed) as T;
  if (value && typeof value === "object" && Object.getPrototypeOf(value) === Object.prototype) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, wellFormed(v)])) as T;
  }
  return value;
}
