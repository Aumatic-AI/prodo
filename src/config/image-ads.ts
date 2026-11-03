// How image ads are made.
// "free" (default): the image model makes the whole ad, words included, from a prompt the Creative
// Director writes with no template; our code only adds the logo in a corner.
// "designed": the earlier way: the model makes a photo and our Satori layouts draw every word.
// "direct" (a test): no Creative Director and no QA. All the context, the product photos and the logo
// go straight to the image model, and its picture is the final ad.
// Set IMAGE_AD_MODE=designed to go back. Carousels, videos and the video end card are unaffected.

export type ImageAdMode = "free" | "designed" | "direct";

export const imageAdMode = (): ImageAdMode => (process.env.IMAGE_AD_MODE === "designed" ? "designed" : process.env.IMAGE_AD_MODE === "direct" ? "direct" : "free");

/**
 * Which image model makes a direct ad. "kie-gpt2" (default): GPT Image 2 on Kie. "openai": OpenAI's own
 * image API directly (chatgpt-image-latest). "kie": Kie's nano-banana-2. Set IMAGE_AD_ENGINE to switch.
 */
export type ImageEngine = "kie-gpt2" | "openai" | "kie";
export const imageEngine = (): ImageEngine => (process.env.IMAGE_AD_ENGINE === "openai" ? "openai" : process.env.IMAGE_AD_ENGINE === "kie" ? "kie" : "kie-gpt2");

/** GPT Image 2 on Kie: 4:5 only exists at 1K; the other sizes are made at 2K. */
export const gpt2Resolution = (ratio: string): "1K" | "2K" => (ratio === "4:5" ? "1K" : "2K");

/**
 * OpenAI's image model and quality for direct ads. "chatgpt-image-latest" is the model the ChatGPT app
 * itself uses; set OPENAI_IMAGE_MODEL to try another one this account has (gpt-image-1.5, gpt-image-2…).
 */
export const openaiImage = () => ({
  model: process.env.OPENAI_IMAGE_MODEL || "chatgpt-image-latest",
  quality: (["low", "medium", "high", "auto"] as const).find((q) => q === process.env.OPENAI_IMAGE_QUALITY) ?? "high",
});

/**
 * The size OpenAI draws for a platform canvas: the canvas's own proportions (edges in multiples of 16),
 * so nothing is cropped off the ad. When the model refuses an unusual size, the standard size nearest
 * to it is used (see openaiFallbackSize) and the rest is cropped.
 */
export function openaiImageSize(ratio: string): string {
  return ratio === "1:1" ? "1024x1024" : ratio === "16:9" ? "1936x1088" : ratio === "9:16" ? "1088x1936" : "1088x1360";
}

export const openaiFallbackSize = (ratio: string): "1024x1024" | "1024x1536" | "1536x1024" => (ratio === "1:1" ? "1024x1024" : ratio === "16:9" ? "1536x1024" : "1024x1536");

/** True when this kind of post is made whole by the image model. */
export const isFreeImageAd = (kind: string): boolean => kind === "static" && imageAdMode() === "free";

/** True when this kind of post skips the AI steps and goes straight to the image model. */
export const isDirectImageAd = (kind: string): boolean => kind === "static" && imageAdMode() === "direct";
