import { z } from "zod";

// Visual Identity Analyst: how the brand looks, from the homepage screenshot and the client's photos.

export const visualStyleSchema = z.object({
  photoStyle: z.string().trim().min(1),
  layoutStyle: z.string().trim().min(1),
});

export type VisualStyle = z.infer<typeof visualStyleSchema>;

export const VISUAL_STYLE_SYSTEM = `You are an art director describing a brand's visual style so designers and image tools can match it.
The first image is the homepage screenshot when one is given; the others are the brand's own photos.

Describe only what you can see. Be concrete and short (2–3 sentences each):
- photoStyle: lighting, colour grading, subjects, setting, framing, people or no people, realism vs. illustration.
- layoutStyle: whitespace, density, shapes and corners, use of colour blocks, typography feel (e.g. bold condensed headings), overall mood.

Return JSON: { "photoStyle": string, "layoutStyle": string }`;

export function visualStylePrompt(brief: string, hasScreenshot: boolean, photoCount: number): string {
  return `${brief}

Images: ${hasScreenshot ? "1 homepage screenshot, then " : ""}${photoCount} brand photo${photoCount === 1 ? "" : "s"}.`;
}
