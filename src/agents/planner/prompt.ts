import { LABELS } from "@/core/creative/brief";
import { platformMeta } from "@/config/platforms";
import type { PlannerContext } from "./context";
import type { SlotPlan } from "./slots";

// The Planner's prompt: the brand, the facts with labels, and the slots our code made.

export interface Labels {
  offering: Map<string, string>;
  offer: Map<string, string>;
  persona: Map<string, string>;
  slot: Map<string, number>;
}

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function buildPlannerPrompt(ctx: PlannerContext, slots: SlotPlan[]): { prompt: string; labels: Labels } {
  const labels: Labels = { offering: new Map(), offer: new Map(), persona: new Map(), slot: new Map() };
  const lines: string[] = [];

  lines.push(`BUSINESS: ${ctx.businessName} (write in language: ${ctx.language})`, `About: ${ctx.description}`, `Main goal: ${ctx.goal ?? "not set"}`);
  if (ctx.positioning) lines.push(`Positioning: ${ctx.positioning}`);
  if (ctx.valueProp) lines.push(`Value proposition: ${ctx.valueProp}`);

  lines.push("", "OFFERINGS");
  const roles = new Map(ctx.offerStack.map((o) => [o.offeringId, o.role]));
  ctx.offerings.forEach((o, i) => {
    labels.offering.set(`O${i + 1}`, o.id);
    const price = o.price !== null ? ` · ${o.price} ${o.currency ?? ""}`.trimEnd() : "";
    lines.push(`[O${i + 1}] ${o.name} (${o.kind}${o.isHero ? ", hero" : ""}${roles.get(o.id) ? `, ${roles.get(o.id)}` : ""})${price}`);
  });
  if (!ctx.offerings.length) lines.push("none confirmed yet: plan brand and value posts only (offering null)");

  if (ctx.offers.length) {
    lines.push("", "OFFERS");
    ctx.offers.forEach((o, i) => {
      labels.offer.set(`F${i + 1}`, o.id);
      const forWhat = o.offeringId ? (ctx.offerings.find((x) => x.id === o.offeringId)?.name ?? "one offering") : "store-wide";
      lines.push(`[F${i + 1}] ${o.title} · for ${forWhat} · ${o.startsAt?.slice(0, 10) ?? "now"} to ${o.endsAt?.slice(0, 10) ?? "no end date"}`);
    });
  }

  lines.push("", "PERSONAS");
  ctx.personas.forEach((p, i) => {
    labels.persona.set(`P${i + 1}`, p.id);
    lines.push(`[P${i + 1}] ${p.name}: ${p.summary ?? ""}${p.pains.length ? ` Pains: ${p.pains.join("; ")}` : ""}`);
  });

  if (ctx.events.length) {
    lines.push("", "CALENDAR");
    ctx.events.forEach((e) => lines.push(`${e.date} · ${e.name} (${e.kind}, relevance ${e.relevance}/5)`));
  }

  const confident = ctx.learnings.filter((l) => l.sample >= 5).sort((a, b) => b.score - a.score);
  if (confident.length) {
    lines.push("", "LEARNINGS (score vs. the account's average, 1.0 = average)");
    confident.slice(0, 20).forEach((l) => lines.push(`${l.dimension} "${l.value}"${l.platform ? ` on ${l.platform}` : ""}: ${l.score.toFixed(2)} from ${l.sample} posts${l.insight ? ` (${l.insight})` : ""}`));
  } else {
    lines.push("", "LEARNINGS: not enough posts yet. Use sound defaults and vary angles to learn.");
  }

  const recentAngles = [...new Set(ctx.recent.map((r) => r.angle).filter(Boolean))];
  if (recentAngles.length) lines.push("", "RECENT ANGLES (don't repeat)", ...recentAngles.slice(0, 30).map((a) => `- ${a}`));

  lines.push("", "SLOTS");
  slots.forEach((s) => {
    const label = `S${s.index + 1}`;
    labels.slot.set(label, s.index);
    const platforms = s.platforms.map((p) => platformMeta(p).label).join(", ");
    const weekday = WEEKDAY[new Date(`${s.day}T12:00:00Z`).getUTCDay()];
    lines.push(
      `[${label}] ${weekday} ${s.day} ${s.time} · ${platforms} · ${LABELS.format[s.format]} · pillar: ${s.pillarName ?? "any"} · stage: ${s.funnelStage}${s.isExperiment ? " · EXPERIMENT" : ""}`
    );
  });

  return { prompt: lines.join("\n"), labels };
}
