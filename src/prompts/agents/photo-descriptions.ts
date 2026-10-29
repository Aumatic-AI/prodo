import { z } from "zod";

// Visual Identity Analyst: one line about each of the client's photos, so the Creative Director
// can pick the right real photo for a scene.

export const photoDescriptionsSchema = z.object({
  photos: z.array(
    z.object({
      /** 1-based, in the order the images were given */
      image: z.number().int().min(1),
      description: z.string().trim().min(1).max(300),
      tags: z.array(z.string().trim().min(1).max(30)).max(6),
    })
  ),
});

export type PhotoDescriptions = z.infer<typeof photoDescriptionsSchema>;

export const PHOTO_DESCRIPTIONS_SYSTEM = `You describe a brand's own photos so an art director can find the right one later.
For each image write one plain sentence of what is in it: the subject (which product, person, place), setting, light, framing (close-up, full body, flat lay), and colours.
Add up to 6 short lowercase tags (e.g. "close-up", "model", "beach", "studio", "red dress").
For an image marked "reference", describe what makes the post work instead: layout, text placement, mood, colours, how the product is shown.
Describe only what you can see. Never guess names or prices.

Return JSON: { "photos": [{ "image": number, "description": string, "tags": string[] }] }`;

export function photoDescriptionsPrompt(brief: string, labels: string[]): string {
  return `${brief}

Images, in order:
${labels.map((l, i) => `${i + 1}. ${l}`).join("\n")}`;
}
