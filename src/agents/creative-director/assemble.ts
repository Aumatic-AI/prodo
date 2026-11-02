import { briefSchema, FACT_LEVERS, type Brief, type Diagnosis, type CtaLink, type Design, type Format, type TemplateId } from "@/core/creative/brief";
import { isFreeImageAd } from "@/config/image-ads";
import { priceText } from "@/creative/video/parts";
import { stripLabelsDeep } from "@/lib/labels";
import type { RawBrief } from "@/prompts/agents/creative-brief";
import { CTA_LINK_KEY } from "@/core/content/prefs";
import type { FactBook } from "./book";
import { assembleVideoScenes } from "./assemble-video";
import type { CreativeContext } from "./context";

// Raw model reply → a Brief: labels become stored refs, claims without a real source are dropped,
// an unbacked badge or fact lever is removed, and anything missing becomes a problem to fix.

export interface Assembled {
  brief: Brief | null;
  problems: string[];
  /** Claims, badges or levers removed for having no source */
  dropped: number;
}

/** The link the model picked when it exists, else the client's next step, else any link we have. */
function ctaLink(wanted: CtaLink, ctx: CreativeContext): CtaLink {
  const primary = ctx.rules.cta ? CTA_LINK_KEY[ctx.rules.cta] : null;
  // The client's next step wins over a generic website link
  if (primary && ctx.ctaLinks[primary] && (wanted === "website" || !ctx.ctaLinks[wanted])) return primary;
  if (ctx.ctaLinks[wanted]) return wanted;
  return (Object.keys(ctx.ctaLinks)[0] as CtaLink) ?? "website";
}

/**
 * The layout and design of an image ad: the model's pick when its style allows it, but never the
 * last ad's layout when there's another to use, and never exactly the last ad's look.
 */
export function pickDesign(raw: Pick<RawBrief, "layout" | "design">, ctx: Pick<CreativeContext, "layouts" | "recentDesigns">): { layout: TemplateId; design: Design } {
  const allowed = ctx.layouts;
  const recent = ctx.recentDesigns;
  let layout = allowed.includes(raw.layout) ? raw.layout : allowed[0];
  if (allowed.length > 1 && recent[0]?.layout === layout) {
    // The allowed layout used longest ago (never used first)
    const lastUse = (l: TemplateId) => {
      const i = recent.findIndex((d) => d.layout === l);
      return i < 0 ? Infinity : i;
    };
    layout = allowed.filter((l) => l !== layout).sort((a, b) => lastUse(b) - lastUse(a))[0];
  }
  const design: Design = { align: raw.design?.align ?? "left", headlineCase: raw.design?.headlineCase ?? "normal", priceStyle: raw.design?.priceStyle ?? "circle" };
  const last = recent[0];
  if (last && last.layout === layout && last.align === design.align && last.headlineCase === design.headlineCase && last.priceStyle === design.priceStyle) {
    design.align = design.align === "left" ? "center" : "left";
  }
  return { layout, design };
}

/** The diagnosis written before the copy (knowledge base §2.12); the parts every ad needs are sent back when missing. */
function diagnosisOf(raw: RawBrief["diagnosis"], problems: string[]): Diagnosis | null {
  const missing = [
    !raw?.desire && "the one desire",
    !raw?.awareness && "the awareness level",
    !raw?.belief && "the belief it starts from",
    !raw?.mechanism && "the mechanism it shows",
  ].filter(Boolean);
  if (!raw || missing.length) {
    problems.push(`Write the diagnosis before the copy: ${missing.length ? missing.join(", ") : "desire, awareness, belief and mechanism"}.`);
    return null;
  }
  return {
    desire: raw.desire!,
    awareness: raw.awareness!,
    sophistication: raw.sophistication ?? 3,
    belief: raw.belief!,
    gradualization: raw.gradualization,
    intensification: raw.intensification ?? "",
    identity: raw.identity ?? "",
    objection: raw.objection,
    redefinition: raw.redefinition,
    mechanism: raw.mechanism!,
    alternative: raw.alternative,
    nativeStyle: raw.nativeStyle ?? "",
  };
}

export function assembleBrief(rawReply: RawBrief, format: Format, ctx: CreativeContext, book: FactBook): Assembled {
  // Source labels stay in the source fields ("R1", no brackets); bracketed ones in text are removed
  const raw = stripLabelsDeep(rawReply);
  const problems: string[] = [];
  let dropped = 0;

  const chosen = raw.hooks[raw.chosenHook - 1] ?? raw.hooks[0];
  if (!chosen) problems.push("Write 8 hook ideas and pick one.");
  // A free image ad has no diagnosis step, layout or word limits: the art director decides
  const free = isFreeImageAd(format);
  const diagnosis = free ? null : diagnosisOf(raw.diagnosis, problems);

  const levers = raw.levers.flatMap((l) => {
    const source = book.ref(l.source);
    if (FACT_LEVERS.includes(l.lever) && !source) {
      dropped++;
      return [];
    }
    return [{ lever: l.lever, source }];
  });

  const claims = raw.claims.flatMap((c) => {
    const source = book.ref(c.source);
    if (!source) {
      dropped++;
      return [];
    }
    return [{ text: c.text, source }];
  });

  const captions: Record<string, string> = {};
  for (const platform of ctx.item.platforms) {
    const text = raw.captions[platform]?.trim();
    if (text) captions[platform] = text;
    else problems.push(`Write the ${platform} caption.`);
  }

  const base = {
    message: raw.message,
    diagnosis,
    // The slot's objective when the Planner set one: the brief serves the plan
    objective: ctx.item.ad_objective ?? raw.objective,
    styleModifier: raw.styleModifier,
    requiresAiLabel: raw.requiresAiLabel,
    hook: chosen ?? { type: "question" as const, text: raw.headline ?? raw.message, visual: null, spoken: null, score: null },
    // Best first: a hook too close to a recent one is swapped for the next best
    hookOptions: raw.hooks.filter((h) => h !== chosen).sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    framework: raw.framework,
    levers,
    cta: { label: raw.cta.label, link: ctaLink(raw.cta.link, ctx) },
    claims,
    captions,
    referenceAssetId: book.asset(raw.photo),
    // Videos: the style actually made (talking videos without talking footage are made as voice-overs)
    style: format === "text" ? null : format === "video" ? (book.video?.style ?? ctx.item.style) : ctx.item.style,
  };

  let candidate: unknown;
  if (format === "static") {
    const badgeOk = raw.badge && book.priceLabels.has(raw.badge.source.trim().replace(/^\[|\]$/g, "").toUpperCase());
    if (raw.badge && !badgeOk) dropped++;
    const badgeSource = badgeOk ? book.ref(raw.badge!.source)! : null;
    // The product's price is written by code ("₪1,790"), never by the model; an offer's deal keeps its words
    const o = ctx.offering;
    const badgeText = badgeSource && o && badgeSource === `offering:${o.id}` && o.price != null ? priceText(Number(o.price), o.currency, o.priceModel) : raw.badge?.text;
    const badge = badgeSource && badgeText ? { text: badgeText, source: badgeSource } : null;
    const picked = pickDesign(raw, ctx);
    // The offer layout is built around a price or deal and the quote layout around a stored review: without one, the style's next layout
    const hasWhatItNeeds = picked.layout === "offer" ? !!badge : picked.layout === "quote" ? claims.some((c) => c.source.startsWith("proof:")) : true;
    if (!hasWhatItNeeds) picked.layout = ctx.layouts.find((l) => l !== "offer" && l !== "quote") ?? "split";
    candidate = {
      kind: "static",
      ...base,
      // A free ad may have no words at all: the hook line stands in as the post's title
      headline: raw.headline || (free ? (chosen?.text ?? raw.message) : ""),
      subhead: raw.subhead,
      badge,
      imagePrompt: raw.imagePrompt ?? "",
      staticFramework: raw.staticFramework,
      logoCorner: free ? (raw.logoCorner ?? "top-left") : null,
      ...picked,
    };
  } else if (format === "carousel") {
    candidate = { kind: "carousel", ...base, slides: raw.slides, imagePrompt: raw.imagePrompt ?? "", staticFramework: raw.staticFramework };
  } else if (format === "video") {
    const plan = book.video!;
    const video = assembleVideoScenes(raw, ctx, book, problems);
    dropped += video.dropped;
    candidate = { kind: "video", ...base, scenes: video.scenes, sound: plan.sound, preset: plan.preset, musicMood: ctx.rules.musicMood ?? raw.musicMood ?? "upbeat" };
  } else {
    candidate = { kind: "text", ...base };
  }

  const parsed = briefSchema.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 6)) problems.push(`${issue.path.join(".") || "brief"}: ${issue.message}`);
    return { brief: null, problems, dropped };
  }
  return { brief: parsed.data, problems, dropped };
}
