import { platformMeta } from "@/config/platforms";
import { briefTexts, countWords, LIMITS, type Brief } from "@/core/creative/brief";
import type { CreativeContext } from "./context";
import { checkVideoBrief } from "./checks-video";

// Code checks on a brief (no AI): word limits, caption lengths, never-say words, urgency without a
// live offer. Each problem is a plain instruction the Creative Director gets back on a redo.

const URGENCY = /\b(today only|last chance|ends (today|tonight|soon|tomorrow)|hurry|limited time|only \d+ left|while stocks last|don'?t miss out|final hours?)\b/i;

// A money amount: a currency sign or code before or after a number ("$455", "455 ILS", "₪1,400")
const MONEY = /(?:[$€£₪₹¥]|\b(?:usd|eur|gbp|ils|nis|inr|aed)\b)\s?(\d[\d,]*(?:\.\d+)?)|(\d[\d,]*(?:\.\d+)?)\s?(?:[$€£₪₹¥]|\b(?:usd|eur|gbp|ils|nis|inr|aed|dollars?|euros?|shekels?)\b)/giu;

/** Every money amount in the texts, as numbers. */
export function pricesIn(texts: string[]): number[] {
  const found: number[] = [];
  for (const t of texts) for (const m of t.matchAll(MONEY)) found.push(Number((m[1] ?? m[2]).replace(/,/g, "")));
  return found.filter((n) => Number.isFinite(n));
}

/** Prices the brief may show: the product's current price, and amounts in the live offer and reviews. */
function allowedPrices(ctx: CreativeContext): Set<number> {
  const allowed = new Set<number>();
  if (ctx.offering?.price != null) allowed.add(Number(ctx.offering.price));
  const quoted = [ctx.offer?.title, ctx.offer?.details, ...(ctx.proof ?? []).map((p) => p.content)].filter((t): t is string => !!t);
  for (const n of pricesIn(quoted)) allowed.add(n);
  return allowed;
}

/** Whole-word (or whole-phrase) match, case-insensitive. */
export function findBanned(texts: string[], banned: string[]): string[] {
  const hits = new Set<string>();
  for (const word of banned) {
    const w = word.trim();
    if (!w) continue;
    const re = new RegExp(`(^|[^\\p{L}\\p{N}])${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^\\p{L}\\p{N}])`, "iu");
    if (texts.some((t) => re.test(t))) hits.add(w);
  }
  return [...hits];
}

export function checkBrief(brief: Brief, ctx: CreativeContext): string[] {
  const problems: string[] = [];
  const over = (text: string, max: number, what: string) => {
    const n = countWords(text);
    if (n > max) problems.push(`${what} has ${n} words; keep it to ${max} or fewer.`);
  };

  over(brief.cta.label, LIMITS.ctaWords, "The call to action");
  for (const [platform, caption] of Object.entries(brief.captions)) {
    const max = platformMeta(platform).captionMaxLength;
    if (caption.length > max) problems.push(`The ${platformMeta(platform).label} caption is ${caption.length} characters; the limit is ${max}.`);
  }

  if (brief.kind === "static") {
    over(brief.headline, LIMITS.headlineWords, "The headline");
    if (brief.subhead) over(brief.subhead, LIMITS.subheadWords, "The subhead");
  }
  if (brief.kind === "carousel") {
    if (brief.slides.length < LIMITS.minSlides || brief.slides.length > LIMITS.maxSlides) {
      problems.push(`Use ${LIMITS.minSlides}–${LIMITS.maxSlides} slides (now ${brief.slides.length}).`);
    }
    brief.slides.forEach((s, i) => {
      over(s.title, LIMITS.slideTitleWords, `Slide ${i + 1}'s title`);
      over(s.body, LIMITS.slideBodyWords, `Slide ${i + 1}'s body`);
    });
  }
  if (brief.kind === "video") problems.push(...checkVideoBrief(brief, ctx));

  // Website passages can be older than the product row the client edits: only current prices may show
  const allowed = allowedPrices(ctx);
  const wrong = [...new Set(pricesIn(briefTexts(brief)).filter((n) => !allowed.has(n)))];
  if (wrong.length) {
    const current = ctx.offering?.price != null ? ` The current price is ${ctx.offering.price}${ctx.offering.currency ? ` ${ctx.offering.currency}` : ""}.` : "";
    problems.push(`Remove prices that aren't the current ones: ${wrong.join(", ")}.${current}`);
  }

  const banned = findBanned(briefTexts(brief), [...ctx.avoidWords, ...ctx.bible.neverSay]);
  if (banned.length) problems.push(`Remove words the brand never uses: ${banned.join(", ")}.`);

  if (!ctx.offer && briefTexts(brief).some((t) => URGENCY.test(t))) {
    problems.push("Remove the urgency or deadline: there is no live offer behind it.");
  }

  // The client wants no people: no person in any picture we ask for
  if (ctx.rules?.people === "none") {
    // Sentences that say "no people" or "without anyone" don't count
    const withPeople = pictureTexts(brief).filter((t) =>
      t.split(/(?<=[.!?;])\s+/).some((sentence) => PEOPLE.test(sentence) && !/\b(no|without|never|nobody|empty of)\b/i.test(sentence))
    );
    if (withPeople.length) problems.push("The business owner wants no people in their posts: describe pictures with only products, places and details (no person, face or body).");
  }
  return problems;
}

// Words that put a person in a picture (hands alone are allowed)
const PEOPLE = /\b(person|people|man|men|woman|women|girl|boy|guy|lady|model|models|customer|customers|client|clients|face|faces|smiling|portrait|selfie|couple|family|team|staff|worker|chef|stylist|someone|crowd)\b/i;

/** What the image and video models are asked to draw. */
export function pictureTexts(brief: Brief): string[] {
  if (brief.kind === "static" || brief.kind === "carousel") return [brief.imagePrompt];
  if (brief.kind === "video") return brief.scenes.map((s) => s.visual);
  return [];
}
