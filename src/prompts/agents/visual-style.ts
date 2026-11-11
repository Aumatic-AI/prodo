import { z } from "zod";

// Visual Identity Analyst: how the brand looks and moves, from screenshots of its website, the client's photos
// and the motion our code read from the site's code.

export const visualStyleSchema = z.object({
  photoStyle: z.string().trim().min(1),
  layoutStyle: z.string().trim().min(1),
  /** Empty when there's no website to read */
  designLanguage: z.string().trim().default(""),
});

export type VisualStyle = z.infer<typeof visualStyleSchema>;

export const VISUAL_STYLE_SYSTEM = `You are an art director describing a brand's visual style so designers, image models and video models can match it.
The images come in this order: screenshots of the brand's website (homepage first, then its key pages) when given; then the brand's own photos; last, posts or ads the client gave as the look they want (references).
Describe the brand as it is, and let the references show the direction it wants to move in.

Describe only what you can see (and, for motion, what the notes from the site's code say). Be concrete and specific to this brand, never generic:
- photoStyle (2–3 sentences): lighting, colour grading, subjects, setting, framing, people or no people, realism vs. illustration.
- layoutStyle (2–3 sentences): whitespace, density, grid, shapes and corners, use of colour blocks, typography feel (e.g. bold condensed headings, spaced-out uppercase labels), overall mood.
- designLanguage (3–5 sentences): the website's signature look, the things that make it recognisable: its components (cards, buttons, labels, frames, dividers, how they're layered, tilted or stacked), recurring graphic motifs (shapes, lines, grids, textures, glows, devices), how images and screens are shown, and how it moves (from the motion notes: smooth or snappy, what animates in and how, hover effects), written so an image or video model could recreate the feel. Never name or quote the site's words, products or people. An empty string when there are no website screenshots.

Return JSON: { "photoStyle": string, "layoutStyle": string, "designLanguage": string }`;

export function visualStylePrompt(brief: string, screenshots: number, photoCount: number, referenceCount = 0, motion: string | null = null): string {
  const images = [
    screenshots && `${screenshots} website screenshot${screenshots === 1 ? "" : "s"}`,
    `${photoCount} brand photo${photoCount === 1 ? "" : "s"}`,
    referenceCount && `${referenceCount} reference${referenceCount === 1 ? "" : "s"}`,
  ].filter(Boolean);
  return `${brief}

Images: ${images.join(", then ")}.${motion ? `\n\nHow the website moves (read from its code): ${motion}` : ""}`;
}
