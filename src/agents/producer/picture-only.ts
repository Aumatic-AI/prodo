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

/** "#81a2d0" → "soft blue": a colour code as the plain words an image model understands. */
export function colourWord(hex: string): string {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h.slice(0, 6);
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  if ([r, g, b].some((v) => Number.isNaN(v))) return "neutral";
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const s = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
  if (s < 0.12) return l > 0.9 ? "white" : l > 0.65 ? "light grey" : l > 0.35 ? "grey" : l > 0.12 ? "charcoal" : "black";
  const d = max - min;
  const hue = (max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  const deg = (hue + 360) % 360;
  let name = deg < 15 || deg >= 345 ? "red" : deg < 40 ? "orange" : deg < 65 ? "yellow" : deg < 160 ? "green" : deg < 195 ? "teal" : deg < 250 ? "blue" : deg < 290 ? "purple" : "pink";
  if (name === "orange" && l < 0.45) name = "brown";
  const shade = l > 0.75 ? "pale " : l > 0.55 ? "soft " : l < 0.3 ? "deep " : "";
  return `${shade}${name}`;
}

/**
 * For image ad photos: our own labels ("G1") and colour codes mean nothing to the image model, so
 * they become words ("the reference image", "soft blue") before pictureOnly keeps only the picture.
 */
export function photoWords(description: string): string {
  return description.replace(/\[?\b[GV]\d{1,2}\b\]?/g, "the reference image").replace(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/gi, (hex) => colourWord(hex));
}
