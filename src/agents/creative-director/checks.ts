import { platformMeta } from "@/config/platforms";
import { briefTexts, countWords, LIMITS, spokenSeconds, type Brief } from "@/core/creative/brief";
import type { CreativeContext } from "./context";

// Code checks on a brief (no AI): word limits, caption lengths, never-say words, urgency without a
// live offer. Each problem is a plain instruction the Creative Director gets back on a redo.

const URGENCY = /\b(today only|last chance|ends (today|tonight|soon|tomorrow)|hurry|limited time|only \d+ left|while stocks last|don'?t miss out|final hours?)\b/i;

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
  if (brief.kind === "video") {
    if (brief.scenes.length < LIMITS.minScenes || brief.scenes.length > LIMITS.maxScenes) {
      problems.push(`Use ${LIMITS.minScenes}–${LIMITS.maxScenes} scenes (now ${brief.scenes.length}).`);
    }
    let total = 0;
    brief.scenes.forEach((s, i) => {
      over(s.overlay, LIMITS.overlayWords, `Scene ${i + 1}'s on-screen text`);
      const sec = spokenSeconds(s.voiceover);
      total += sec;
      if (sec > 8.5) problems.push(`Scene ${i + 1}'s voice-over takes about ${Math.round(sec)} seconds to say; keep each scene under 8 seconds.`);
    });
    if (total > 40) problems.push(`The voice-over runs about ${Math.round(total)} seconds; keep the whole video under 35 seconds.`);
    if (total < 8) problems.push(`The voice-over is only about ${Math.round(total)} seconds; aim for 15–35 seconds.`);
  }

  const banned = findBanned(briefTexts(brief), [...ctx.avoidWords, ...ctx.bible.neverSay]);
  if (banned.length) problems.push(`Remove words the brand never uses: ${banned.join(", ")}.`);

  if (!ctx.offer && briefTexts(brief).some((t) => URGENCY.test(t))) {
    problems.push("Remove the urgency or deadline: there is no live offer behind it.");
  }
  return problems;
}
