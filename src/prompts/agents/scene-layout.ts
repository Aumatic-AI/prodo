import { z } from "zod";

// Producer (video): where things are in each scene's picture, so our renderer places words, prices
// and stickers beside the subject instead of on it. One vision call for all the stills of a video.

const unit = z.coerce.number().min(0).max(1);

export const sceneLayoutSchema = z.object({
  scenes: z.array(
    z.object({
      /** 1-based, in the order the images were given */
      image: z.number().int().min(1),
      /** The main subject (the product, the person's face and body, the finished work) as fractions of the image */
      subject: z.object({ x: unit, y: unit, w: unit, h: unit }).nullable().catch(null),
      /** The calmest band for words: little detail, no faces, not the subject */
      textZone: z.enum(["top", "middle", "bottom"]).catch("bottom"),
      /** Whether that band is light (white words need a stronger shade) */
      light: z.boolean().catch(false),
    })
  ),
});
export type SceneLayout = z.infer<typeof sceneLayoutSchema>["scenes"][number];

export const SCENE_LAYOUT_SYSTEM = `You lay out text for a video editor. For each image (a vertical video frame), find:
- subject: the box around the main subject (the product, a person's face and upper body, the finished work), as fractions of the image width and height: x and y of the top-left corner, w and h. null when nothing stands out.
- textZone: the band (top, middle or bottom third) that is calmest for adding words: plain background, no faces, not covering the subject.
- light: true when that band is mostly light or white.

Return JSON: { "scenes": [{ "image": number, "subject": { "x", "y", "w", "h" } | null, "textZone": "top" | "middle" | "bottom", "light": boolean }] }`;

export function sceneLayoutPrompt(count: number): string {
  return `${count} video frames, in order. One entry per image.`;
}
