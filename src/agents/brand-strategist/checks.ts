import { AppError } from "@/core/errors";
import { stripLabelsDeep } from "@/lib/labels";
import type { BibleContent, BiblePersona, BiblePillar, Claim, OfferStackItem } from "@/core/brand/bible";
import type { Audience, BibleCore, RawClaim } from "@/prompts/agents/brand-bible";
import type { SourceBook } from "./sources";

// Code checks on the model's draft (no AI):
// - every claim needs at least one real source, otherwise it's dropped
// - 3–4 personas, 4–5 pillars, pillar shares add up to 1
// - never-say words don't appear anywhere else in the Bible

export const PERSONAS = { min: 3, max: 4 };
export const PILLARS = { min: 4, max: 5 };

/** True when the text uses any never-say word or phrase (whole words, any case). */
export function usesBannedWord(text: string, banned: string[]): boolean {
  const lower = text.toLowerCase();
  return banned.some((word) => {
    const w = word.trim().toLowerCase();
    if (!w) return false;
    const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, "u").test(lower);
  });
}

/** Rounds shares to 3 decimals that add up to exactly 1. Equal shares when the model gave none. */
export function normaliseShares(shares: number[]): number[] {
  const total = shares.reduce((a, b) => a + b, 0);
  const raw = total > 0 ? shares.map((s) => s / total) : shares.map(() => 1 / shares.length);
  const rounded = raw.map((s) => Math.round(s * 1000) / 1000);
  const drift = Math.round((1 - rounded.reduce((a, b) => a + b, 0)) * 1000) / 1000;
  if (rounded.length) rounded[rounded.indexOf(Math.max(...rounded))] += drift;
  return rounded.map((s) => Math.round(s * 1000) / 1000);
}

export interface CheckReport {
  content: BibleContent;
  /** Claims removed for having no source or using a never-say word */
  dropped: number;
}

export function assembleBible(core: BibleCore, audience: Audience, book: SourceBook, clientAvoidWords: string[], note: string | null): CheckReport {
  let dropped = 0;
  const neverSay = [...new Set([...clientAvoidWords, ...core.neverSay].map((w) => w.trim()).filter(Boolean))];

  const toClaim = (raw: RawClaim): Claim | null => {
    const sources = book.toRefs(raw.sources);
    if (!sources.length || usesBannedWord(raw.text, neverSay)) {
      dropped++;
      return null;
    }
    return { text: raw.text, sources };
  };
  const claims = (list: RawClaim[]) => list.map(toClaim).filter((c): c is Claim => !!c);

  const positioning = toClaim(core.positioning);
  const valueProp = toClaim(core.valueProp);
  const toneSummary = toClaim(core.tone.summary);
  if (!positioning || !valueProp || !toneSummary) {
    // Retryable: the next attempt usually cites properly
    const core3: [string, RawClaim, Claim | null][] = [
      ["positioning", core.positioning, positioning],
      ["value proposition", core.valueProp, valueProp],
      ["tone summary", core.tone.summary, toneSummary],
    ];
    const problems = core3
      .filter(([, , kept]) => !kept)
      .map(([name, raw]) => `the ${name} ${book.toRefs(raw.sources).length ? "uses a word from the never-say list" : "cites no fact we have"}`);
    throw new AppError(`The Brand Bible draft was dropped: ${problems.join("; ")}.`, "UNKNOWN", true);
  }

  const offerStack: OfferStackItem[] = [];
  const seenOfferings = new Set<string>();
  for (const item of core.offerStack) {
    const offering = book.offering(item.offering);
    const pitch = toClaim({ ...item.pitch, sources: [...item.pitch.sources, item.offering] });
    if (!offering || !pitch || seenOfferings.has(offering.id)) continue;
    seenOfferings.add(offering.id);
    offerStack.push({ offeringId: offering.id, name: offering.name, role: item.role, pitch, pending: offering.pending });
  }

  const personas: BiblePersona[] = audience.personas
    .map((p) => ({ ...p, sources: book.toRefs(p.sources) }))
    .filter((p) => {
      const ok = p.sources.length > 0 && !usesBannedWord([p.summary, ...p.phrases].join(" "), neverSay);
      if (!ok) dropped++;
      return ok;
    })
    .slice(0, PERSONAS.max);

  const pillarsRaw = audience.pillars.slice(0, PILLARS.max);
  if (personas.length < PERSONAS.min || pillarsRaw.length < PILLARS.min) {
    throw new AppError(
      `The Brand Bible draft was dropped: it had ${personas.length} usable persona${personas.length === 1 ? "" : "s"} (needs ${PERSONAS.min}; ${audience.personas.length - personas.length} cited no fact or used a never-say word) and ${pillarsRaw.length} content pillar${pillarsRaw.length === 1 ? "" : "s"} (needs ${PILLARS.min}).`,
      "UNKNOWN",
      true
    );
  }
  const shares = normaliseShares(pillarsRaw.map((p) => p.share));
  const pillars: BiblePillar[] = pillarsRaw.map((p, i) => ({
    name: p.name,
    description: p.description,
    share: shares[i],
    funnelStage: p.funnelStage ?? null,
    examples: p.examples.filter((e) => !usesBannedWord(e, neverSay)),
  }));

  return {
    // Labels like [C10] are for our source tracking only; the client never sees them
    content: stripLabelsDeep({
      positioning,
      value_prop: valueProp,
      tone_guide: {
        summary: toneSummary,
        traits: claims(core.tone.traits),
        examples: core.tone.examples.filter((e) => !usesBannedWord(e, neverSay)),
      },
      visual_rules: claims(core.visualRules),
      offer_stack: offerStack,
      do_dont: { do: claims(core.do), dont: claims(core.dont) },
      never_say: neverSay,
      personas,
      pillars,
      // The market diagnosis is judgement, not a fact: only its mechanism needs a source
      strategy: core.strategy
        ? {
            ...core.strategy,
            mechanism: core.strategy.mechanism ? toClaim(core.strategy.mechanism) : null,
            beliefs: core.strategy.beliefs.filter((b) => !usesBannedWord(b, neverSay)),
            identity: usesBannedWord(core.strategy.identity, neverSay) ? "" : core.strategy.identity,
          }
        : null,
      note,
    }),
    dropped,
  };
}
