import { isFreeImageAd } from "@/config/image-ads";
import { platformMeta } from "@/config/platforms";
import { TEMPLATE_NOTES } from "@/creative/templates/notes";
import { CTA_LINK_KEY, ctaWords, peopleRule } from "@/core/content/prefs";
import { isImageStyle, isVideoStyle, styleBrief } from "@/core/content/styles";
import type { Format } from "@/core/creative/brief";
import type { Moment } from "@/core/brand/footage";
import type { CreativeContext } from "./context";
import { videoPlan, videoSection, type VideoPlan } from "./video-book";

export { slotSound } from "./video-book";

// The facts the Creative Director may use, numbered ([O1], [F1], [R2], [C3], [G1] photos, [V1]
// video moments), and the map back to stored refs. Built the same way every time, so labels mean the same thing in every step.

export interface FactBook {
  text: string;
  /** "R2" → "proof:<id>"; unknown labels → null */
  ref: (label: string | null | undefined) => string | null;
  /** "G1" → brand_assets id */
  asset: (label: string | null | undefined) => string | null;
  /** Labels that can back a price or offer badge */
  priceLabels: Set<string>;
  /** "V3" → a moment of the client's own video */
  moment: (label: string | null | undefined) => Moment | null;
  /** Video slots: the style made, its storyline, sound and look */
  video: VideoPlan | null;
}

const clean = (label: string) => label.trim().replace(/^\[|\]$/g, "").toUpperCase();

/** The content style line for the slot, when its style fits its format. */
function styleLine(style: string | null, format: Format): string | null {
  if (!style || format === "text") return null;
  if (format === "video" ? !isVideoStyle(style) : !isImageStyle(style)) return null;
  return styleBrief(style, format);
}

export function buildFactBook(ctx: CreativeContext): FactBook {
  const refs = new Map<string, string>();
  const assets = new Map<string, string>();
  const priceLabels = new Set<string>();
  const lines: string[] = [];

  lines.push(`BUSINESS: ${ctx.business.name} · write in language: ${ctx.business.language}`, `About: ${ctx.business.description}`);
  if (ctx.business.goals.length) lines.push(`Goals, in order: ${ctx.business.goals.join(", then ")}`);
  if (ctx.bible.positioning) lines.push(`Positioning: ${ctx.bible.positioning}`);
  if (ctx.bible.valueProp) lines.push(`Value proposition: ${ctx.bible.valueProp}`);
  // The market diagnosis from the Brand Bible: where every ad's diagnosis starts
  const st = ctx.bible.strategy;
  if (st) {
    lines.push("", "MARKET (from the Brand Bible)", `Sophistication: ${st.sophistication}/5${st.sophisticationWhy ? ` (${st.sophisticationWhy})` : ""}`);
    if (st.desires.length) lines.push(`Desires buyers bring: ${st.desires.join(", ")}`);
    if (st.beliefs.length) lines.push(`Beliefs they hold: ${st.beliefs.map((b) => `"${b}"`).join("; ")}`);
    if (st.identity) lines.push(`Who they become: ${st.identity}`);
    if (st.mechanism) lines.push(`How it works differently: ${st.mechanism.text}`);
    if (st.distinctiveAssets.length) lines.push(`Brand cues to show early: ${st.distinctiveAssets.join("; ")}`);
  }

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
  lines.push(`Angle: ${it.angle ?? "brand post"}`, `What it should do: ${it.objective ?? ""}`);
  // The Planner's strategy for the slot (plans made before it have none)
  if (it.ad_objective) lines.push(`OBJECTIVE: ${it.ad_objective}`);
  else lines.push(`Funnel stage: ${it.funnel_stage ?? "tofu"}`);
  if (it.desire) lines.push(`Planned desire: ${it.desire}`);
  if (it.awareness_level) lines.push(`Planned awareness level: ${it.awareness_level}`);
  const video = it.format === "video" ? videoPlan(ctx) : null;
  const style = styleLine(video?.style ?? it.style, it.format);
  if (style) lines.push(`CONTENT STYLE (the business owner chose this; follow it): ${style}`);
  const people = peopleRule(ctx.rules.people);
  if (people && it.format !== "text") lines.push(`PEOPLE: ${people}`);
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
  if (ctx.rules.cta) {
    const key = CTA_LINK_KEY[ctx.rules.cta];
    lines.push(`CUSTOMERS' NEXT STEP (the business owner's choice): ${ctaWords(ctx.rules.cta)}${ctx.ctaLinks[key] ? `; use link "${key}"` : ""}. Every call to action leads there.`);
  }

  if (ctx.assets.length) {
    lines.push(
      "",
      ctx.item.format === "video"
        ? video?.storyline.prefer === "photos"
          ? "REAL PHOTOS (this style shows them as they are, with gentle motion; for an AI scene a photo is the reference that gives the product)"
          : "REAL PHOTOS (never shown as they are in this style: each is the reference image an AI scene takes its product from, and gives the product only, never its model, pose or place)"
        : "REAL PHOTOS (pick one as the reference image when it fits. A reference keeps the real product; only person and team photos keep their real person)"
    );
    ctx.assets.forEach((a, i) => {
      assets.set(`G${i + 1}`, a.id);
      if (ctx.item.format === "video") {
        lines.push(`[G${i + 1}] ${a.kind}${a.offeringId && a.offeringId === ctx.offering?.id ? " of this offering" : ""}: ${a.description ?? "no description"}`);
        return;
      }
      // Image ads: say which product a photo shows, so an ad about the brand can still pick a real one
      const what = a.kind === "product_photo" && a.offeringName ? `product photo of "${a.offeringName}"${a.offeringId === ctx.offering?.id ? " (this offering)" : ""}` : a.kind.replace("_", " ");
      lines.push(`[G${i + 1}] ${what}${a.description ? `: ${a.description}` : ""}`);
    });
  }
  if (ctx.photoStyle) lines.push("", `PHOTO STYLE: ${ctx.photoStyle}`);
  if (isFreeImageAd(ctx.item.format)) {
    if (ctx.logoTone) {
      lines.push(
        "",
        `LOGO: code adds the brand's logo after the picture is made. ${
          ctx.logoTone === "both" ? "It has a light and a dark version, and the one that reads on the picture is used." : `It is a ${ctx.logoTone} logo, so keep its corner ${ctx.logoTone === "dark" ? "light" : "dark"}.`
        }`
      );
    } else lines.push("", "LOGO: none goes on this ad.");
    if (ctx.recentConcepts.length) lines.push("", "RECENT IMAGE ADS (newest first; make this one a different idea and a different-looking picture)", ...ctx.recentConcepts.map((c) => `- ${c}`));
  } else if (ctx.item.format === "static") {
    lines.push("", "LAYOUTS FOR THIS STYLE (pick the one that suits this message and photo)", ...ctx.layouts.map((l) => `- ${l}: ${TEMPLATE_NOTES[l]}`));
    if (ctx.recentDesigns.length) {
      lines.push(
        "RECENT IMAGE DESIGNS (newest first; make this one look different)",
        ...ctx.recentDesigns.map((d) => `- ${d.layout}, ${d.align} aligned, ${d.headlineCase} headline, price as ${d.priceStyle}`)
      );
    }
  }
  if (ctx.bible.visualRules.length) lines.push(`VISUAL RULES: ${ctx.bible.visualRules.join("; ")}`);
  const moments = video ? videoSection(ctx, video, lines) : new Map<string, Moment>();
  if (ctx.recentHooks.length) lines.push("", "RECENT HOOKS (don't repeat or closely copy)", ...ctx.recentHooks.slice(0, 15).map((h) => `- ${h}`));

  return {
    text: lines.filter((l) => l !== undefined).join("\n"),
    ref: (label) => (label ? (refs.get(clean(label)) ?? null) : null),
    asset: (label) => (label ? (assets.get(clean(label)) ?? null) : null),
    priceLabels,
    moment: (label) => (label ? (moments.get(clean(label)) ?? null) : null),
    video,
  };
}
