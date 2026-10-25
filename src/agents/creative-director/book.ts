import { platformMeta } from "@/config/platforms";
import type { CreativeContext } from "./context";

// The facts the Creative Director may use, numbered ([O1], [F1], [R2], [C3], [G1], [A1]), and the
// map back to stored refs. Built the same way every time, so labels mean the same thing in every step.

export interface FactBook {
  text: string;
  /** "R2" → "proof:<id>"; unknown labels → null */
  ref: (label: string | null | undefined) => string | null;
  /** "G1" → brand_assets id */
  asset: (label: string | null | undefined) => string | null;
  /** Labels that can back a price or offer badge */
  priceLabels: Set<string>;
}

const clean = (label: string) => label.trim().replace(/^\[|\]$/g, "").toUpperCase();

export function buildFactBook(ctx: CreativeContext): FactBook {
  const refs = new Map<string, string>();
  const assets = new Map<string, string>();
  const priceLabels = new Set<string>();
  const lines: string[] = [];

  lines.push(`BUSINESS: ${ctx.business.name} · write in language: ${ctx.business.language}`, `About: ${ctx.business.description}`);
  if (ctx.bible.positioning) lines.push(`Positioning: ${ctx.bible.positioning}`);
  if (ctx.bible.valueProp) lines.push(`Value proposition: ${ctx.bible.valueProp}`);

  lines.push("", "VOICE");
  lines.push(`Tone sliders: ${ctx.business.tone}`);
  if (ctx.bible.tone) lines.push(`Tone: ${ctx.bible.tone}`);
  ctx.bible.traits.forEach((t) => lines.push(`- ${t}`));
  if (ctx.bible.examples.length) lines.push(`Example lines: ${ctx.bible.examples.map((e) => `"${e}"`).join(" ")}`);
  if (ctx.bible.dos.length) lines.push(`Do: ${ctx.bible.dos.join("; ")}`);
  if (ctx.bible.donts.length) lines.push(`Don't: ${ctx.bible.donts.join("; ")}`);
  const never = [...new Set([...ctx.avoidWords, ...ctx.bible.neverSay])];
  if (never.length) lines.push(`NEVER SAY: ${never.join(", ")}`);

  lines.push("", "THIS SLOT");
  const it = ctx.item;
  lines.push(`Platforms: ${it.platforms.map((p) => `${platformMeta(p).label} (caption up to ${platformMeta(p).captionMaxLength} characters)`).join(", ")}`);
  lines.push(`Angle: ${it.angle ?? "brand post"}`, `Objective: ${it.objective ?? ""}`, `Funnel stage: ${it.funnel_stage ?? "tofu"}`);
  if (ctx.pillar) lines.push(`Content pillar: ${ctx.pillar.name}${ctx.pillar.description ? ` (${ctx.pillar.description})` : ""}`);
  if (it.hook_type) lines.push(`Suggested hook type: ${it.hook_type}`);
  if (it.levers?.length) lines.push(`Suggested levers: ${it.levers.join(", ")}`);
  if (it.is_experiment) lines.push("This is an EXPERIMENT slot: try something fresh for this brand.");

  if (ctx.persona) {
    const p = ctx.persona;
    lines.push("", `PERSONA: ${p.name}`, p.summary ?? "");
    if (p.pains.length) lines.push(`Pains: ${p.pains.join("; ")}`);
    if (p.desires.length) lines.push(`Desires: ${p.desires.join("; ")}`);
    if (p.objections.length) lines.push(`Objections: ${p.objections.join("; ")}`);
    if (p.triggers.length) lines.push(`Buying triggers: ${p.triggers.join("; ")}`);
    if (p.phrases.length) lines.push(`Words they use: ${p.phrases.join("; ")}`);
  }

  lines.push("", "FACTS YOU MAY USE (cite the label)");
  if (ctx.offering) {
    const o = ctx.offering;
    refs.set("O1", `offering:${o.id}`);
    const price = o.price !== null ? ` · price ${o.priceModel === "from" ? "from " : ""}${o.price} ${o.currency ?? ""}`.trimEnd() : "";
    if (price) priceLabels.add("O1");
    lines.push(`[O1] ${o.name} (${o.kind})${price}${o.description ? ` · ${o.description}` : ""}`);
    if (o.benefits.length) lines.push(`     benefits: ${o.benefits.join("; ")}`);
    if (o.audience) lines.push(`     for: ${o.audience}`);
    if (o.objections.length) lines.push(`     objections and FAQs: ${o.objections.join("; ")}`);
  }
  if (ctx.offer) {
    refs.set("F1", `offer:${ctx.offer.id}`);
    priceLabels.add("F1");
    const o = ctx.offer;
    lines.push(`[F1] OFFER: ${o.title}${o.details ? ` · ${o.details}` : ""}${o.code ? ` · code ${o.code}` : ""}${o.endsAt ? ` · ends ${o.endsAt.slice(0, 10)}` : ""}`);
  }
  ctx.proof.forEach((p, i) => {
    refs.set(`R${i + 1}`, `proof:${p.id}`);
    lines.push(`[R${i + 1}] ${p.kind}${p.author ? ` by ${p.author}` : ""}${p.rating ? ` (${p.rating}/5)` : ""}: ${p.content}`);
  });
  ctx.passages.forEach((p, i) => {
    refs.set(`C${i + 1}`, `chunk:${p.id}`);
    lines.push(`[C${i + 1}] ${p.text.replace(/\s+/g, " ")}`);
  });

  const links = Object.keys(ctx.ctaLinks);
  lines.push("", `CALL-TO-ACTION LINKS AVAILABLE: ${links.length ? links.join(", ") : "website only"}`);
  if (ctx.disclaimers.length) lines.push(`REQUIRED DISCLAIMERS (add to captions when the claim needs them): ${ctx.disclaimers.join(" | ")}`);

  if (ctx.assets.length) {
    lines.push("", "REAL PHOTOS (pick one as the reference image when it fits; the image model keeps the real product/person)");
    ctx.assets.forEach((a, i) => {
      assets.set(`G${i + 1}`, a.id);
      lines.push(`[G${i + 1}] ${a.kind}${a.offeringId && a.offeringId === ctx.offering?.id ? " of this offering" : ""}: ${a.description ?? "no description"}`);
    });
  }
  if (ctx.photoStyle) lines.push("", `PHOTO STYLE: ${ctx.photoStyle}`);
  if (ctx.item.format === "static") lines.push(`LAYOUTS THIS BRAND USES (pick one): ${ctx.layouts.join(", ")}`);
  if (ctx.bible.visualRules.length) lines.push(`VISUAL RULES: ${ctx.bible.visualRules.join("; ")}`);
  if (ctx.recentHooks.length) lines.push("", "RECENT HOOKS (don't repeat or closely copy)", ...ctx.recentHooks.slice(0, 15).map((h) => `- ${h}`));

  return {
    text: lines.filter((l) => l !== undefined).join("\n"),
    ref: (label) => (label ? (refs.get(clean(label)) ?? null) : null),
    asset: (label) => (label ? (assets.get(clean(label)) ?? null) : null),
    priceLabels,
  };
}
