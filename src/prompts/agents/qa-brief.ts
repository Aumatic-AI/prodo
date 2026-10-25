import { z } from "zod";
import { clipOr, score10, textList } from "./lenient";

// QA Critic, Gate 1: scores a brief before any money is spent on images or video.

const score = score10;

export const briefScoreSchema = z.object({
  // A missing block counts as middling scores rather than an unreadable reply
  scores: z
    .object({
      hook: score,
      oneMessage: score,
      personaFit: score,
      cta: score,
      proof: score,
      compliance: score,
    })
    .catch({ hook: 5, oneMessage: 5, personaFit: 5, cta: 5, proof: 5, compliance: 5 }),
  /** Plain fixes for the Creative Director, most important first */
  fixes: textList(6, 400, 3),
  summary: clipOr(600),
});
export type BriefScore = z.infer<typeof briefScoreSchema>;

export const QA_BRIEF_SYSTEM = `You are a strict creative QA lead for social ads. Score this brief from 0 to 10 on:
- hook: would it stop the scroll in the first 2 seconds for this persona? Specific beats generic.
- oneMessage: does the whole ad carry one clear message?
- personaFit: does it speak to this persona's pains, desires and words?
- cta: is the call to action clear, specific and right for the funnel stage?
- proof: are claims backed by the listed facts, with nothing invented? (A brief with no claims can still score well if it makes none.)
- compliance: no never-say words, no forbidden claims, no fake urgency, required disclaimers present, platform-appropriate.

Be honest: 7 means good enough to publish for a real brand; 9+ is excellent. List concrete fixes (what to change and how), most important first, only when a score is below 8.

Return JSON: { "scores": { "hook": n, "oneMessage": n, "personaFit": n, "cta": n, "proof": n, "compliance": n }, "fixes": string[], "summary": string }`;

/** Weighted overall score: the hook and compliance matter most. */
export function overallScore(s: BriefScore["scores"]): number {
  const total = s.hook * 0.25 + s.oneMessage * 0.15 + s.personaFit * 0.15 + s.cta * 0.15 + s.proof * 0.1 + s.compliance * 0.2;
  return Math.round(total * 10) / 10;
}
