// Image and video models only make pictures; our code draws every word. A scene description can
// still mention words on screen ("leave a margin for the disclaimer in Fraunces type"), and the model
// then paints made-up text. Sentences about text, layout or typography are removed before the
// description goes to the model.

const ABOUT_WORDS =
  /\b(disclaimers?|overlays?|captions?|subtitles?|typography|typefaces?|fonts?|lettering|headlines?|copy|wording|legible|margins?|text (?:panel|box|area|block)|on-screen|call to action|cta|logo placement|end card)\b|#[0-9a-f]{3,8}\b/i;
/** "No text, letters or logos…" sentences are kept: they tell the model what not to draw */
const NEGATIVE = /^\s*(no|without|avoid|never|do not|don't)\b/i;

/** The scene description with only what the camera sees. */
export function pictureOnly(description: string): string {
  const sentences = description.match(/[^.!?]+[.!?]*/g) ?? [description];
  const kept = sentences.filter((s) => NEGATIVE.test(s) || !ABOUT_WORDS.test(s));
  const out = kept.join("").replace(/\s+/g, " ").trim();
  // Never send an empty prompt: fall back to the first sentence without colour codes
  return out || (sentences[0] ?? description).replace(/#[0-9a-f]{3,8}\b/gi, "").trim();
}
