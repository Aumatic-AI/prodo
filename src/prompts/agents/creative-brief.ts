import { z } from "zod";
import { clip } from "./lenient";
import { CTA_LINKS, FRAMEWORKS, HOOK_TYPES, LEVERS, LIMITS, TEMPLATE_IDS, type Format } from "@/core/creative/brief";

// Creative Director: one slot → a complete brief. The model cites fact labels ([O1], [F1], [R2],
// [C3]) and picks a real photo ([G1]); code maps labels back to ids, checks every limit and
// drops anything without a source.

// Long text is cut to size (the checks after this enforce the real word limits), never rejected
const str = (max: number) => clip(max);
const opt = (max: number) =>
  clip(max)
    .nullish()
    .catch(null)
    .transform((v) => v || null);

const lenient = <T extends z.ZodTypeAny>(item: T, max: number) =>
  z
    .array(z.unknown())
    .nullish()
    .transform((values) =>
      (values ?? [])
        .flatMap((value) => {
          const parsed = item.safeParse(value);
          return parsed.success ? [parsed.data as z.output<T>] : [];
        })
        .slice(0, max)
    );

export const rawBriefSchema = z.object({
  message: str(300),
  hooks: lenient(z.object({ type: z.enum(HOOK_TYPES).catch("question"), text: str(200).pipe(z.string().min(3)) }), 10),
  chosenHook: z.number().int().min(1).catch(1),
  framework: z.enum(FRAMEWORKS).catch("aida"),
  levers: lenient(z.object({ lever: z.enum(LEVERS), source: opt(10) }), 4),
  cta: z.object({ label: str(40).pipe(z.string().min(2)), link: z.enum(CTA_LINKS).catch("website") }),
  claims: lenient(z.object({ text: str(400).pipe(z.string().min(1)), source: str(10) }), 8),
  captions: z.record(z.string(), z.string()).catch({}),
  photo: opt(10),
  // Image ad
  headline: opt(120),
  subhead: opt(200),
  badge: z.object({ text: str(30), source: str(10) }).nullish().catch(null),
  imagePrompt: opt(1200),
  layout: z.enum(TEMPLATE_IDS).catch("spotlight"),
  // Carousel
  slides: lenient(z.object({ title: str(120).pipe(z.string().min(1)), body: str(400).default("") }), 10),
  // Video
  scenes: lenient(
    z.object({ voiceover: str(300).pipe(z.string().min(2)), overlay: str(80).default(""), visual: str(800).pipe(z.string().min(5)), motion: str(200).default("slow push in") }),
    8
  ),
  musicMood: opt(60),
});
export type RawBrief = z.infer<typeof rawBriefSchema>;

const COMMON = `You are the creative director of a social media ad studio. Turn one planned slot into a complete, production-ready brief.

Craft rules:
- One clear message per ad ("message"). Everything serves it.
- Write 8 hook ideas, one of each type: ${HOOK_TYPES.join(", ")}. Each under 12 words, specific to this persona and angle, not generic. Pick the strongest as "chosenHook" (its 1-based number). Don't copy recent hooks.
- Framework: one of ${FRAMEWORKS.join(", ")} (AIDA, problem-agitate-solve, before-after-bridge, hook-story-offer).
- Levers: up to 3 of ${LEVERS.join(", ")}. social_proof, authority, scarcity and urgency need a fact label as "source" (a review, credential or live offer); others use null.
- Facts only: every price, number, result, review, award, guarantee or deadline must come from FACTS with its label, listed in "claims" as { "text", "source": "R1" }. Never invent any. No urgency or deadlines unless there is a live offer [F1].
- Call to action: "cta.label" up to ${LIMITS.ctaWords} words (e.g. "Book a free call"); "cta.link" is one of the available links.
- Captions: one per platform key given (e.g. "instagram"), native to that platform, within its character limit, ending with the call to action. Instagram/TikTok: 3–6 relevant hashtags at the end. LinkedIn: no more than 3 hashtags. X: short. Add a required disclaimer when a claim needs it.
- Respect the voice, the do/don't rules and NEVER SAY. Write in the business's language.
- "photo": the label of the real photo to use as reference ([G1]…) when one shows the product, team or place this ad is about; otherwise null.`;

const FORMAT_RULES: Record<Format, string> = {
  static: `FORMAT: single image ad. Our code draws all text over a photo; the image model only makes the photo.
- headline: at most ${LIMITS.headlineWords} words, punchy (usually your chosen hook or a tight version of it).
- subhead: at most ${LIMITS.subheadWords} words, or null.
- badge: a short price or offer sticker (e.g. "From €49", "-20%") ONLY from a fact with a price or offer, with its label as "source"; otherwise null.
- imagePrompt: describe the photo only: subject, setting, light, composition, mood, matching the photo style. Leave calm space for text (say where). Absolutely no text, letters, logos, signs or watermarks in the image.
- layout: one of ${TEMPLATE_IDS.join(", ")}: spotlight = full photo with words at the bottom; split = photo on top, words in a clean panel; frame = premium dark canvas with the photo as a card; bold = headline in a solid brand block.`,
  carousel: `FORMAT: carousel of ${LIMITS.minSlides}–${LIMITS.maxSlides} slides. Our code designs the slides.
- slides[0] is the cover: "title" = the hook (at most ${LIMITS.slideTitleWords} words), body empty.
- Middle slides: one idea each. "title" at most ${LIMITS.slideTitleWords} words, "body" at most ${LIMITS.slideBodyWords} words. Make each slide earn the next swipe (steps, tips, myths vs facts, before/after, a story).
- Last slide: the call to action: "title" = the payoff or offer, "body" = one line on what to do.
- imagePrompt: the cover photo only, no text in the image, leave space at the bottom for the hook.`,
  video: `FORMAT: short vertical video, ${LIMITS.minScenes}–${LIMITS.maxScenes} scenes, 15–35 seconds in total.
- Scene 1 is the hook: it must grab attention in the first 2 seconds.
- Each scene: "voiceover" (spoken, natural, about ${LIMITS.wordsPerSecond} words per second, 2–8 seconds of speech), "overlay" (big on-screen text, at most ${LIMITS.overlayWords} words, can be empty), "visual" (what the camera sees: subject, setting, light; no text, letters or logos in the picture; no one speaking to camera), "motion" (one camera move, e.g. "slow push in", "gentle pan left").
- The last scene lands the call to action.
- musicMood: a few words for background music (e.g. "warm acoustic, upbeat").`,
  text: `FORMAT: text-only post. Put the full post in each platform's caption; the hook is the first line. No image.`,
};

export function creativeSystem(format: Format): string {
  return `${COMMON}

${FORMAT_RULES[format]}

Return JSON with these keys: message, hooks [{type, text}], chosenHook, framework, levers [{lever, source}], cta {label, link}, claims [{text, source}], captions {platform: text}, photo${
    format === "static" ? ", headline, subhead, badge {text, source} | null, imagePrompt, layout" : format === "carousel" ? ", slides [{title, body}], imagePrompt" : format === "video" ? ", scenes [{voiceover, overlay, visual, motion}], musicMood" : ""
  }.`;
}

export function creativePrompt(book: string, platforms: string[], feedback: string[] | null, note: string | null): string {
  const parts = [book, "", `CAPTION KEYS: ${platforms.join(", ")}`];
  if (note) parts.push("", `THE CLIENT ASKED FOR THIS CHANGE: "${note}". Follow it unless it breaks the facts rules.`);
  if (feedback?.length) parts.push("", "YOUR LAST BRIEF WAS SENT BACK. Fix all of these:", ...feedback.map((f) => `- ${f}`));
  return parts.join("\n");
}
