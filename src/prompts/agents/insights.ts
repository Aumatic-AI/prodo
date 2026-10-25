import { z } from "zod";
import { clip, objectList, textList } from "./lenient";

// Performance Analyst: plain-English insights and the weekly report. Code works out every number;
// the model only explains them. Each insight must name its numbers.

export const insightsSchema = z.object({
  insights: objectList(z.object({ key: z.string(), insight: clip(400) }), 20),
  report: z.object({
    headline: clip(160).pipe(z.string().min(5)),
    summary: clip(1200).pipe(z.string().min(10)),
    nextWeek: textList(4, 300, 5),
  }),
});
export type Insights = z.infer<typeof insightsSchema>;

export const INSIGHTS_SYSTEM = `You are the performance analyst for a business's social media. Our code measured everything; you explain it to the business owner in plain, friendly words.

For each numbered learning, write one short insight (one sentence) that names its numbers (the score as "x times the usual" or a percentage, and how many posts it rests on), and says what it means for future posts. Low-confidence learnings say they are early signs.
Then write the weekly report:
- headline: one line on how the week went, with a number.
- summary: 2–4 sentences: results vs. the week before, the best post and why it likely worked, anything that underperformed.
- nextWeek: 2–4 concrete things the planner will do differently, each grounded in a learning.

Never invent numbers; use only the ones given. Write in the business's language.

Return JSON: { "insights": [{ "key": "L1", "insight": string }], "report": { "headline": string, "summary": string, "nextWeek": string[] } }`;
