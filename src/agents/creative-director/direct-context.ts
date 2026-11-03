import { platformMeta } from "@/config/platforms";
import { CTA_LINK_KEY, ctaWords, peopleRule } from "@/core/content/prefs";
import { isImageStyle, styleBrief } from "@/core/content/styles";
import { briefSchema, type Brief, type CtaLink } from "@/core/creative/brief";
import type { CreativeContext } from "./context";

// "Direct" image ads (IMAGE_AD_MODE=direct): no Creative Director and no QA. Everything the Creative
// Director would have read goes to the image model as plain facts, together with the product photos
// and the logo, and the model's picture is the final ad. Nothing here says how the picture should
// look. The brief that goes with the post is made by code, since the post still needs a title,
// captions and a call to action.

/** What the images attached to the request are, in order (so the model knows which is the product and which the logo) */
export interface DirectImage {
  url: string;
  what: string;
}

export interface DirectColours {
  primary: string;
  accent: string;
  heading: string;
  body: string;
}

const list = (label: string, values: string[]) => (values.length ? [`${label}: ${values.join("; ")}`] : []);

/** The business, the post and the research as plain text: the same information the Creative Director gets. */
export function directContext(ctx: CreativeContext, colours: DirectColours | null, images: DirectImage[]): string {
  const b = ctx.bible;
  const it = ctx.item;
  const lines: string[] = [];

  lines.push(`BUSINESS: ${ctx.business.name} (language: ${ctx.business.language})`, `About: ${ctx.business.description}`);
  if (ctx.business.goals.length) lines.push(`Goals, in order: ${ctx.business.goals.join(", then ")}`);
  if (b.positioning) lines.push(`Positioning: ${b.positioning}`);
  if (b.valueProp) lines.push(`Value proposition: ${b.valueProp}`);

  lines.push("", "VOICE", `Tone sliders: ${ctx.business.tone}`);
  if (b.tone) lines.push(`Tone: ${b.tone}`);
  lines.push(...b.traits.map((t) => `- ${t}`));
  lines.push(...(b.examples.length ? [`Example lines: ${b.examples.map((e) => `"${e}"`).join(" ")}`] : []), ...list("Do", b.dos), ...list("Don't", b.donts));
  const never = [...new Set([...ctx.avoidWords, ...b.neverSay])];
  lines.push(...list("Never say", never));

  const st = b.strategy;
  if (st) {
    lines.push("", "MARKET", `Sophistication: ${st.sophistication}/5${st.sophisticationWhy ? ` (${st.sophisticationWhy})` : ""}`);
    lines.push(...list("Desires buyers bring", st.desires), ...list("Beliefs they hold", st.beliefs), ...(st.identity ? [`Who they become: ${st.identity}`] : []));
    if (st.mechanism) lines.push(`How it works differently: ${st.mechanism.text}`);
    lines.push(...list("Brand cues", st.distinctiveAssets));
  }

  lines.push("", "BRAND LOOK");
  if (colours) lines.push(`Colours: primary ${colours.primary}, accent ${colours.accent}`, `Fonts: ${colours.heading} (headings), ${colours.body} (text)`);
  if (ctx.photoStyle) lines.push(`Photo style: ${ctx.photoStyle}`);
  lines.push(...list("Visual rules", b.visualRules));

  lines.push("", "THIS POST", `Platforms: ${it.platforms.map((p) => platformMeta(p).label).join(", ")}`, `Angle: ${it.angle ?? "brand post"}`);
  if (it.objective) lines.push(`What it should do: ${it.objective}`);
  if (it.ad_objective) lines.push(`Objective: ${it.ad_objective}`);
  if (it.desire) lines.push(`Desire: ${it.desire}`);
  if (it.awareness_level) lines.push(`Audience awareness: ${it.awareness_level}`);
  if (it.style && isImageStyle(it.style)) lines.push(`Content style the owner chose: ${styleBrief(it.style, "static")}`);
  const people = peopleRule(ctx.rules.people);
  if (people) lines.push(`People: ${people}`);
  if (ctx.pillar) lines.push(`Content pillar: ${ctx.pillar.name}${ctx.pillar.description ? ` (${ctx.pillar.description})` : ""}`);

  if (ctx.persona) {
    const p = ctx.persona;
    lines.push("", `AUDIENCE: ${p.name}`, ...(p.summary ? [p.summary] : []), ...list("Pains", p.pains), ...list("Desires", p.desires), ...list("Objections", p.objections), ...list("Buying triggers", p.triggers), ...list("Words they use", p.phrases));
  }

  if (ctx.offering) {
    const o = ctx.offering;
    const price = o.price !== null ? ` · price ${o.priceModel === "from" ? "from " : ""}${o.price} ${o.currency ?? ""}`.trimEnd() : "";
    lines.push("", `PRODUCT: ${o.name} (${o.kind})${price}${o.description ? ` · ${o.description}` : ""}`, ...list("Benefits", o.benefits), ...(o.audience ? [`For: ${o.audience}`] : []), ...list("Objections and FAQs", o.objections));
  }
  if (ctx.offer) {
    const o = ctx.offer;
    lines.push("", `OFFER: ${o.title}${o.details ? ` · ${o.details}` : ""}${o.code ? ` · code ${o.code}` : ""}${o.endsAt ? ` · ends ${o.endsAt.slice(0, 10)}` : ""}`);
  }
  if (ctx.proof.length) {
    lines.push("", "REVIEWS");
    ctx.proof.forEach((p) => lines.push(`- ${p.kind}${p.author ? ` by ${p.author}` : ""}${p.rating ? ` (${p.rating}/5)` : ""}: ${p.content}`));
  }
  if (ctx.passages.length) {
    lines.push("", "FROM THE WEBSITE");
    ctx.passages.forEach((p) => lines.push(`- ${p.text.replace(/\s+/g, " ")}`));
  }

  lines.push("", "WHERE PEOPLE GO NEXT");
  lines.push(...Object.entries(ctx.ctaLinks).map(([k, v]) => `${k}: ${v}`));
  if (ctx.rules.cta) lines.push(`Owner's chosen next step: ${ctaWords(ctx.rules.cta)}`);
  lines.push(...list("Required disclaimers", ctx.disclaimers));

  if (images.length) lines.push("", "ATTACHED IMAGES", ...images.map((im, i) => `Image ${i + 1}: ${im.what}`));
  return lines.join("\n");
}

/** What goes to the image model: one plain request, then everything above. */
export const DIRECT_REQUEST =
  "Create one new ad image for this business's post, based on the details below. The attached images are references for the real product and the brand's logo: make a new picture, not a collage of them.";

/** Kie's prompt box is large but not endless; the context rarely comes near this. */
const MAX_PROMPT = 12_000;

/** The research labels the Brand Bible keeps for itself: "(sources: ["A2", "O1"])" means nothing to a picture */
const withoutSources = (text: string) => text.replace(/\s*\(sources: \[[^\]]*\]\)/g, "");

export function directPrompt(context: string): string {
  const text = withoutSources(`${DIRECT_REQUEST}\n\n${context}`);
  return text.length > MAX_PROMPT ? `${text.slice(0, MAX_PROMPT).trimEnd()}…` : text;
}

/** The post's brief, made by code (no AI): a title, a caption per platform and the call to action. */
export function directBrief(ctx: CreativeContext, referenceAssetId: string | null): Brief {
  const it = ctx.item;
  const angle = (it.angle ?? "").trim() || `${ctx.offering?.name ?? ctx.business.name}`;
  const key = ctx.rules.cta ? CTA_LINK_KEY[ctx.rules.cta] : null;
  const link: CtaLink = (key && ctx.ctaLinks[key] ? key : "website") as CtaLink;
  const next = ctx.rules.cta ? ctaWords(ctx.rules.cta) : "Learn more";
  const url = ctx.ctaLinks[link] ?? ctx.ctaLinks.website ?? "";
  const captions: Record<string, string> = {};
  for (const platform of it.platforms) {
    const text = [angle, [next, url].filter(Boolean).join(" · ")].filter(Boolean).join("\n\n");
    captions[platform] = text.slice(0, platformMeta(platform).captionMaxLength);
  }
  return briefSchema.parse({
    kind: "static",
    message: angle.slice(0, 300).padEnd(5, "."),
    hook: { type: "bold_claim", text: angle.slice(0, 200).padEnd(3, ".") },
    framework: "aida",
    levers: [],
    cta: { label: next.split(/\s+/).slice(0, 4).join(" ").slice(0, 40).padEnd(2, "."), link },
    claims: [],
    captions,
    referenceAssetId,
    style: it.style,
    headline: angle.slice(0, 80).padEnd(2, "."),
    imagePrompt: "Direct ad: the image model made the whole ad from the full business context and the attached images.",
    layout: "spotlight",
  });
}
