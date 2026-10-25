// The models cite facts with bracketed labels ([C10], [O1, R2]) so our code can trace them. Those
// tags belong in the `sources` fields, never in text the client reads: strip them from every string.

const LABELS = /\s*\[(?:[A-Z]{1,2}\d{0,3})(?:\s*,\s*[A-Z]{1,2}\d{0,3})*\]/g;

export function stripLabels(text: string): string {
  return text.replace(LABELS, "").replace(/\s{2,}/g, " ").trim();
}

/** Fields that hold labels on purpose (they're mapped to stored refs), left as they are. */
const LABEL_FIELDS = new Set(["source", "sources", "photo", "slot", "offering", "offer", "persona", "key"]);

/** Every string in a value (objects and arrays too), without source labels. */
export function stripLabelsDeep<T>(value: T): T {
  if (typeof value === "string") return stripLabels(value) as T;
  if (Array.isArray(value)) return value.map(stripLabelsDeep) as T;
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, LABEL_FIELDS.has(k) ? v : stripLabelsDeep(v)])) as T;
  }
  return value;
}
