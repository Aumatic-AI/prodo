// Producer (image ads): where the subject and the calm side are in the finished photo, so our layout
// puts the words beside the subject instead of on it. Same reply as the video scene layout.

export { sceneLayoutSchema as photoLayoutSchema } from "./scene-layout";

export const PHOTO_LAYOUT_SYSTEM = `You lay out text over an ad photo. Find:
- subject: the box around the main subject (the product, a person's face and body with what they wear, the finished work), as fractions of the image width and height: x and y of the top-left corner, w and h. null when nothing stands out.
- textZone: the band (top, middle or bottom third) that is calmest for adding words: plain background, no faces, not covering the subject or the product.
- light: true when that band is mostly light or white.

Return JSON: { "scenes": [{ "image": 1, "subject": { "x", "y", "w", "h" } | null, "textZone": "top" | "middle" | "bottom", "light": boolean }] }`;

export const PHOTO_LAYOUT_PROMPT = "One ad photo.";
