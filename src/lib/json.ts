/** Parses JSON from an AI reply, ignoring ```json fences. Throws on bad JSON. */
export function parseJson<T = any>(text: string): T {
  const cleaned = text.replace(/```json\n?|\n?```/g, "").trim();
  return JSON.parse(cleaned);
}
