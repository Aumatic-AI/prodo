// How image ads are made.
// "free" (default): the image model makes the whole ad, words included, from a prompt the Creative
// Director writes with no template; our code only adds the logo in a corner.
// "designed": the earlier way: the model makes a photo and our Satori layouts draw every word.
// Set IMAGE_AD_MODE=designed to go back. Carousels, videos and the video end card are unaffected.

export type ImageAdMode = "free" | "designed";

export const imageAdMode = (): ImageAdMode => (process.env.IMAGE_AD_MODE === "designed" ? "designed" : "free");

/** True when this kind of post is made whole by the image model. */
export const isFreeImageAd = (kind: string): boolean => kind === "static" && imageAdMode() === "free";
