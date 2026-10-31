import { briefSchema, FACT_LEVERS, type Brief, type CtaLink, type Format } from "@/core/creative/brief";
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


export function assembleBrief(rawReply: RawBrief, format: Format, ctx: CreativeContext, book: FactBook): Assembled {
  // Source labels stay in the source fields ("R1", no brackets); bracketed ones in text are removed
  const raw = stripLabelsDeep(rawReply);
  const problems: string[] = [];
  let dropped = 0;

  const chosen = raw.hooks[raw.chosenHook - 1] ?? raw.hooks[0];
  if (!chosen) problems.push("Write 8 hook ideas and pick one.");

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
    hook: chosen ?? { type: "question" as const, text: raw.headline ?? raw.message },
    hookOptions: raw.hooks.filter((h) => h !== chosen),
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
    candidate = {
      kind: "static",
      ...base,
      headline: raw.headline ?? "",
      subhead: raw.subhead,
      badge: badgeOk ? { text: raw.badge!.text, source: book.ref(raw.badge!.source)! } : null,
      imagePrompt: raw.imagePrompt ?? "",
      // Only layouts the brand chose in its brand kit
      layout: ctx.layouts?.includes(raw.layout) ? raw.layout : (ctx.layouts?.[0] ?? raw.layout),
    };
  } else if (format === "carousel") {
    candidate = { kind: "carousel", ...base, slides: raw.slides, imagePrompt: raw.imagePrompt ?? "" };
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
