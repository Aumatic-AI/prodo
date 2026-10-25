import type { SourceRef } from "@/core/brand/bible";
import { ANSWER_LABELS } from "@/core/brand/sources";
import type { StrategistInput } from "./inputs";
import type { Passage } from "./retrieve";

// The numbered sources shown to the model ([A1], [C3], [O2], [R1], [K]) and the map back to
// real refs. Built the same way in every step, so labels mean the same thing everywhere.

export interface SourceBook {
  /** Prompt text listing every source with its label */
  text: string;
  /** Labels the model cited → refs we store; unknown labels are dropped */
  toRefs: (labels: string[]) => SourceRef[];
  /** Offering label (O3) → offering */
  offering: (label: string) => StrategistInput["offerings"][number] | null;
}

export function buildSourceBook(input: StrategistInput, passages: Passage[]): SourceBook {
  const refs = new Map<string, SourceRef>();
  const lines: string[] = [];

  lines.push("CLIENT'S ANSWERS");
  Object.entries(input.answers)
    .filter(([, value]) => value)
    .forEach(([key, value], i) => {
      refs.set(`A${i + 1}`, `answer:${key}`);
      lines.push(`[A${i + 1}] ${ANSWER_LABELS[key] ?? key}: ${value}`);
    });

  lines.push("", "OFFERINGS");
  input.offerings.forEach((o, i) => {
    refs.set(`O${i + 1}`, `offering:${o.id}`);
    const price = o.price !== null ? ` · ${o.price} ${o.currency ?? ""}`.trimEnd() : "";
    const extra = [o.benefits.length && `benefits: ${o.benefits.join("; ")}`, o.audience && `for: ${o.audience}`].filter(Boolean).join(" · ");
    lines.push(`[O${i + 1}] ${o.name} (${o.kind}${o.isHero ? ", hero" : ""}${o.pending ? ", found on website, not confirmed yet" : ""})${price}${extra ? ` · ${extra}` : ""}`);
  });

  if (input.proof.length) {
    lines.push("", "PROOF (reviews, numbers, awards)");
    input.proof.forEach((p, i) => {
      refs.set(`R${i + 1}`, `proof:${p.id}`);
      lines.push(`[R${i + 1}] ${p.kind}${p.author ? ` by ${p.author}` : ""}: ${p.content}`);
    });
  }

  if (input.kit) {
    refs.set("K", "kit");
    lines.push("", "BRAND KIT", `[K] ${input.kit.replace(/\n/g, " · ")}`);
  }

  if (passages.length) {
    lines.push("", "PASSAGES FROM THE WEBSITE AND POSTS");
    passages.forEach((p, i) => {
      refs.set(`C${i + 1}`, `chunk:${p.id}`);
      lines.push(`[C${i + 1}] ${p.text.replace(/\s+/g, " ")}`);
    });
  }

  if (input.marketNotes.length) {
    lines.push("", "MARKET NOTES (context only, don't cite)");
    input.marketNotes.forEach((n, i) => lines.push(`[M${i + 1}] ${n}`));
  }

  const clean = (label: string) => label.trim().replace(/^\[|\]$/g, "").toUpperCase();
  return {
    text: lines.join("\n"),
    toRefs: (labels) => [...new Set(labels.map((l) => refs.get(clean(l))).filter((r): r is SourceRef => !!r))],
    offering: (label) => {
      const match = clean(label).match(/^O(\d+)$/);
      return match ? (input.offerings[Number(match[1]) - 1] ?? null) : null;
    },
  };
}
