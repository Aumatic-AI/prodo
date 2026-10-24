/** Lowercase letters and digits only, so "Blue Mug (12oz)" and "blue mug 12 oz" match. */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

const FILLER = new Set(["a", "an", "the", "and", "or", "of", "for", "to", "with", "our", "your", "by", "in", "on", "at"]);

/** Meaningful words of a name, roughly singular: "SPC Floors & Tiles" → ["spc", "floor", "tile"]. */
export function nameWords(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]+/gu, " ")
    .split(/\s+/)
    .filter((w) => w && !FILLER.has(w))
    .map((w) => (w.length > 4 ? w.replace(/(ing|es|s)$/, "") : w));
}

/**
 * True when two names very likely mean the same thing, e.g. "Lead gen & outreach" and
 * "Lead Gen & Outreach Automation", or "SPC floors" and "SPC Flooring". A one-word name only
 * matches the same word, so "Decking" and "Decking Boards" stay apart.
 */
export function sameName(a: string, b: string): boolean {
  if (nameKey(a) === nameKey(b)) return true;
  const x = new Set(nameWords(a));
  const y = new Set(nameWords(b));
  if (!x.size || !y.size) return false;
  const [small, big] = x.size <= y.size ? [x, y] : [y, x];
  const shared = [...small].filter((w) => big.has(w)).length;
  if (shared === small.size && (small.size >= 2 || big.size === 1)) return true;
  return shared / new Set([...x, ...y]).size >= 0.75;
}
