import { z } from "zod";
import { clipOr, score10, textList } from "./lenient";

// QA Critic, Gate 2: looks at the finished asset. Images and carousels with OpenAI vision,
// videos with Twelve Labs.

export const imageReviewSchema = z.object({
  score: score10,
  /** null when there is no reference photo to compare with */
  productMatches: z.boolean().nullable().catch(null),
  /** Letters, words or fake logos the image model put in the photo */
  strayText: z.boolean().catch(false),
  onBrand: z.boolean().catch(true),
  issues: textList(6, 400, 3),
  /** One instruction for the image model on a redo */
  fix: clipOr(600),
});
export type ImageReview = z.infer<typeof imageReviewSchema>;

export const IMAGE_QA_SYSTEM = `You are the final quality check for a social media ad before a client sees it. You get images in this order: the reference photo of the real product (if any), the raw AI photo behind the design, then the finished design(s). All text on the designs was drawn by our code on purpose (headline, button, badge, logo); judge it for layout only.

Check:
- productMatches: does the AI photo show the same product/person/place as the reference photo (shape, colours, details)? null if there is no reference.
- strayText: does the raw AI photo contain any letters, words, numbers, fake logos or signage (these look broken in ads)?
- onBrand: does it look professional and consistent with the brand description?
- Also look for: distorted hands, faces or objects, odd artifacts, text over a busy area that is hard to read, anything cut off, anything offensive or misleading.

score 0–10: 7 = good enough to publish for a real brand. List concrete issues, and "fix": one short instruction for the image model to make a better photo (empty if none needed).

Return JSON: { "score": n, "productMatches": true | false | null, "strayText": boolean, "onBrand": boolean, "issues": string[], "fix": string }`;

/** The still image behind each video scene, checked for words the image model painted in. */
export const sceneTextSchema = z.object({
  scenes: z
    .array(z.object({ scene: z.number().int().catch(0), strayText: z.boolean().catch(false), note: clipOr(300) }))
    .catch([]),
});

export const SCENE_TEXT_SYSTEM = `You check the still images behind the scenes of a short video ad, given in scene order (the first image is scene 1). Our editor adds no words to these pictures, so any letters, words, numbers, fake logos, signs, labels or text panels inside an image are a defect.

For each image answer strayText (true if any such text is visible) and a short note saying what you see.

Return JSON: { "scenes": [{ "scene": 1, "strayText": boolean, "note": string }] }`;

export interface VideoReview {
  score: number;
  hookVisible: boolean;
  scenes: { scene: number; matches: boolean; glitch: boolean; aiText: boolean; note: string }[];
  summary: string;
}

/** JSON schema for Twelve Labs' structured answer. */
export const VIDEO_REVIEW_JSON_SCHEMA = {
  type: "object",
  properties: {
    score: { type: "number" },
    hookVisible: { type: "boolean" },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: { scene: { type: "integer" }, matches: { type: "boolean" }, glitch: { type: "boolean" }, aiText: { type: "boolean" }, note: { type: "string" } },
        required: ["scene", "matches", "glitch", "aiText", "note"],
      },
    },
    summary: { type: "string" },
  },
  required: ["score", "hookVisible", "scenes", "summary"],
};

export function videoReviewPrompt(hook: string, scenes: { index: number; start: number; end: number; visual: string }[]): string {
  return `You are the final quality check for a short social media video ad before the client sees it.
The hook "${hook}" should be on screen in big text within the first 3 seconds. Our editor adds on purpose: captions of what is said with key words highlighted, on-screen lines, number counters, review cards, a price tag, emoji stickers, transitions and a closing card with the call to action. Photo scenes with a slow camera move, and a clip briefly holding its last frame, are on purpose too. Some scenes are the business's own real footage: judge them as real video.

The script, scene by scene (seconds):
${scenes.map((s) => `Scene ${s.index + 1} (${s.start.toFixed(1)}–${s.end.toFixed(1)} s): ${s.visual}`).join("\n")}

For each scene answer: matches (the picture shows roughly what the script describes), glitch (warped faces, hands or objects, flicker, morphing, frozen frames, broken motion), aiText (garbled letters or fake logos inside the picture itself, not our captions), and a short note.
hookVisible: is the hook text clearly visible in the first 3 seconds?
score 0–10 for the whole video: 7 = good enough to publish for a real brand.

Answer in JSON: { "score": n, "hookVisible": boolean, "scenes": [{ "scene": 1, "matches": boolean, "glitch": boolean, "aiText": boolean, "note": string }], "summary": string }`;
}
