import { MODELS } from "@/config/models";
import { ai } from "@/providers/ai/registry";
import type { Usage } from "@/providers/usage";
import { CONSOLIDATE_SYSTEM, consolidateSchema } from "@/prompts/agents/consolidate-facts";

// One AI check over everything the website showed: which items repeat each other or what the
// owner already entered, and which "offerings" are really client projects. It only drops items.

export interface FactLine {
  /** F1, F2… for found items; K1, K2… for known ones */
  id: string;
  kind: "offering" | "offer" | "proof";
  /** e.g. "case study", "service", "review" */
  label: string;
  text: string;
  page?: string;
}

const MAX_TEXT = 350;

function line(f: FactLine): string {
  const page = f.page ? ` (page ${f.page.replace(/^https?:\/\/[^/]+/, "") || "/"})` : "";
  return `[${f.id}] ${f.label}${page}: ${f.text.replace(/\s+/g, " ").slice(0, MAX_TEXT)}`;
}

/**
 * Ids of found items to leave out. Only drops an item when the model points at a kept item it
 * repeats, so a confused answer can never drop both copies of something.
 */
export async function findRepeats(found: FactLine[], known: FactLine[]): Promise<{ drop: Set<string>; usage: Usage | null }> {
  if (!found.length || found.length + known.length < 2) return { drop: new Set(), usage: null };

  const prompt = `KNOWN\n${known.map(line).join("\n") || "(nothing yet)"}\n\nFOUND\n${found.map(line).join("\n")}`;
  const res = await ai.structured(consolidateSchema, prompt, { system: CONSOLIDATE_SYSTEM, model: MODELS.extract });

  const byId = new Map(found.map((f) => [f.id, f]));
  const knownIds = new Set(known.map((k) => k.id));
  const decisions = new Map(res.data.items.map((d) => [d.id, d]));

  // Follows "duplicate of" links to the item that is kept; null when the chain is broken or loops
  const keeper = (id: string, seen = new Set<string>()): string | null => {
    if (seen.has(id)) return null;
    seen.add(id);
    const d = decisions.get(id);
    if (!d || d.decision === "keep") return byId.has(id) ? id : null;
    if (d.decision === "duplicate" && d.sameAs) return keeper(d.sameAs, seen);
    return null;
  };

  const drop = new Set<string>();
  for (const [id, d] of decisions) {
    const item = byId.get(id);
    if (!item) continue;
    if (d.decision === "already_known" && d.sameAs && knownIds.has(d.sameAs)) drop.add(id);
    else if (d.decision === "not_an_offering" && item.kind === "offering") drop.add(id);
    else if (d.decision === "duplicate" && d.sameAs) {
      const kept = keeper(d.sameAs);
      if (kept && kept !== id) drop.add(id);
    }
  }
  return { drop, usage: res.usage };
}
