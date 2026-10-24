import { z } from "zod";

// Social & Market Analyst: what makes a video work (Twelve Labs Pegasus reads the video itself).

export const videoAnalysisSchema = z.object({
  hook: z.string().trim().default(""),
  hookType: z.string().trim().default(""),
  structure: z.string().trim().default(""),
  pacing: z.enum(["slow", "medium", "fast"]).catch("medium"),
  onScreenText: z.string().trim().default(""),
  whyItWorks: z.string().trim().default(""),
});

export type VideoAnalysis = z.infer<typeof videoAnalysisSchema>;

/** JSON schema sent to Twelve Labs so the answer comes back in this shape. */
export const VIDEO_ANALYSIS_JSON_SCHEMA = {
  type: "object",
  properties: {
    hook: { type: "string" },
    hookType: { type: "string" },
    structure: { type: "string" },
    pacing: { type: "string", enum: ["slow", "medium", "fast"] },
    onScreenText: { type: "string" },
    whyItWorks: { type: "string" },
  },
  required: ["hook", "hookType", "structure", "pacing", "onScreenText", "whyItWorks"],
};

export function videoAnalysisPrompt(context: string): string {
  return `You are reviewing a short social video for a marketing team. ${context}

Answer as JSON:
- hook: the exact opening line or on-screen text of the first 3 seconds (quote it)
- hookType: one or two words, e.g. "question", "bold claim", "before/after", "problem", "curiosity", "number list", "demo"
- structure: the beats in order, e.g. "hook → problem → product demo → result → CTA"
- pacing: slow, medium or fast
- onScreenText: the main captions or text overlays, short
- whyItWorks: one sentence on why it performs (or doesn't, if it's described as a weak post)`;
}
