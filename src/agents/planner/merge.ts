import type { PlannerReply, SlotChoice } from "@/prompts/agents/planner";
import type { AdObjective, AwarenessLevel, Desire } from "@/core/creative/brief";
import { stripLabels } from "@/lib/labels";
import type { PlannerContext } from "./context";
import type { Labels } from "./prompt";
import { avoidRepeats, type SlotPlan } from "./slots";

// Joins the code's slots with the model's choices and checks them: labels must exist, offers must
// be live on the slot's date and fit its offering, personas rotate when one is missing, and the same
// offering or angle never runs twice in a row on a platform when it can be swapped.

export interface PlannedItem extends SlotPlan {
  offeringId: string | null;
  offerId: string | null;
  personaId: string | null;
  angle: string;
  objective: string;
  desire: Desire | null;
  awarenessLevel: AwarenessLevel;
  hookType: string;
  levers: string[];
  rationale: string;
}

/** Awareness levels each objective is for (knowledge base §2.2); the first is the default */
const OBJECTIVE_AWARENESS: Record<AdObjective, AwarenessLevel[]> = {
  awareness: ["problem_aware", "unaware"],
  converting: ["solution_aware", "problem_aware", "product_aware"],
  retargeting: ["product_aware", "most_aware"],
};

/** The model's level when it fits the slot's objective, else the objective's usual one. */
export function fitAwareness(objective: AdObjective, level: AwarenessLevel | null): AwarenessLevel {
  const fits = OBJECTIVE_AWARENESS[objective];
  return level && fits.includes(level) ? level : fits[0];
}

const clean = (label: string | null) => label?.trim().replace(/^\[|\]$/g, "").toUpperCase() ?? null;

function offerIsLive(ctx: PlannerContext, offerId: string, offeringId: string | null, slotAt: string): boolean {
  const offer = ctx.offers.find((o) => o.id === offerId);
  if (!offer) return false;
  const t = new Date(slotAt).getTime();
  if (offer.startsAt && new Date(offer.startsAt).getTime() > t) return false;
  if (offer.endsAt && new Date(offer.endsAt).getTime() <= t) return false;
  return !offer.offeringId || offer.offeringId === offeringId;
}

export function mergePlan(ctx: PlannerContext, slots: SlotPlan[], reply: PlannerReply, labels: Labels): PlannedItem[] {
  const bySlot = new Map<number, SlotChoice>();
  for (const choice of reply.slots) {
    const index = labels.slot.get(clean(choice.slot) ?? "");
    if (index !== undefined && !bySlot.has(index)) bySlot.set(index, choice);
  }

  const items = slots.map((slot, i): PlannedItem => {
    const c = bySlot.get(slot.index);
    const offeringId = c?.offering ? (labels.offering.get(clean(c.offering)!) ?? null) : null;
    const offerLabel = c?.offer ? (labels.offer.get(clean(c.offer)!) ?? null) : null;
    const offerId = offerLabel && offerIsLive(ctx, offerLabel, offeringId, slot.slotAt) ? offerLabel : null;
    const personaId = (c?.persona ? labels.persona.get(clean(c.persona)!) : null) ?? ctx.personas[i % Math.max(1, ctx.personas.length)]?.id ?? null;
    // Scarcity needs a live offer behind it
    const levers = (c?.levers ?? []).filter((l) => offerId || l !== "scarcity");
    return {
      ...slot,
      offeringId,
      offerId,
      personaId,
      angle: stripLabels(c?.angle ?? `${slot.pillarName ?? "Brand"} post`),
      objective: stripLabels(c?.objective ?? "Build interest in the brand"),
      desire: c?.desire ?? null,
      awarenessLevel: fitAwareness(slot.adObjective, c?.awarenessLevel ?? null),
      hookType: c?.hookType ?? "question",
      levers,
      rationale: stripLabels(c?.rationale ?? "Keeps the week's pillar mix on target."),
    };
  });

  const swapContent = (a: PlannedItem, b: PlannedItem) => {
    const fields = ["offeringId", "offerId", "personaId", "angle", "objective", "desire", "hookType", "levers", "rationale"] as const;
    const x = a as unknown as Record<string, unknown>;
    const y = b as unknown as Record<string, unknown>;
    for (const f of fields) [x[f], y[f]] = [y[f], x[f]];
  };
  avoidRepeats(items, (s) => s.offeringId, swapContent);
  avoidRepeats(items, (s) => s.angle.toLowerCase(), swapContent);
  // A swap can move an offer to a date outside it
  for (const item of items) if (item.offerId && !offerIsLive(ctx, item.offerId, item.offeringId, item.slotAt)) item.offerId = null;
  return items;
}

/** Slots per pillar against target, for the plan's strategy (and the ±10% check). */
export function pillarMix(ctx: PlannerContext, items: PlannedItem[]) {
  return ctx.pillars.map((p) => ({
    pillarId: p.id,
    name: p.name,
    target: Math.round(p.share * 100) / 100,
    planned: items.length ? Math.round((items.filter((i) => i.pillarId === p.id).length / items.length) * 100) / 100 : 0,
  }));
}
