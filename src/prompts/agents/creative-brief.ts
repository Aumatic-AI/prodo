import { z } from "zod";
import { clip } from "./lenient";
import { CTA_LINKS, FRAMEWORKS, HOOK_TYPES, LEVERS, LIMITS, TEMPLATE_IDS, type Format } from "@/core/creative/brief";
import { SCENE_KINDS, STICKER_NAMES, TRANSITION_INTENTS } from "@/core/creative/video";

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
    z.object({
      kind: z.enum(SCENE_KINDS).catch("benefit"),
      /** "V3", "G2" or "AI" */
      source: opt(10),
      voiceover: opt(300).transform((v) => v ?? ""),
      seconds: z.number().min(1).max(15).nullish().catch(null).transform((v) => v ?? null),
      overlay: str(80).default(""),
      keywords: z
        .array(z.string())
        .nullish()
        .catch(null)
        .transform((v) => (v ?? []).map((k) => k.trim()).filter(Boolean).slice(0, 3)),
      visual: str(800).pipe(z.string().min(5)),
      motion: str(200).default("slow push in"),
      sticker: z.enum(STICKER_NAMES).nullish().catch(null).transform((v) => v ?? null),
      stat: z
        .object({ value: z.coerce.number(), label: str(60).pipe(z.string().min(1)), prefix: str(4).default(""), suffix: str(12).default(""), source: str(10) })
        .nullish()
        .catch(null)
        .transform((v) => v ?? null),
      review: opt(10),
      price: z.boolean().catch(false).default(false),
      reveal: opt(10),
      revealVisual: opt(800),
      transition: z.enum(TRANSITION_INTENTS).catch("smooth"),
    }),
    9
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
- The product [O], offer [F] and review [R] facts are current. Website passages [C] can be older: when they disagree, the [O], [F] or [R] fact wins, and never take a price or deadline from a [C] passage.
- Call to action: "cta.label" up to ${LIMITS.ctaWords} words (e.g. "Book a free call"); "cta.link" is one of the available links.
- Captions: one per platform key given (e.g. "instagram"), native to that platform, within its character limit, ending with the call to action. Instagram/TikTok: 3–6 relevant hashtags at the end. LinkedIn: no more than 3 hashtags. X: short. Add a required disclaimer when a claim needs it.
- Respect the voice, the do/don't rules and NEVER SAY. Write in the business's language.
- "photo": the label of the real photo to use as reference ([G1]…) when one shows the product, team or place this ad is about; otherwise null.
- The business owner's choices come first: follow the CONTENT STYLE, SOUND and PEOPLE lines, and point the call to action at CUSTOMERS' NEXT STEP when it is given.`;

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
  video: `FORMAT: short vertical video ad (Reels, TikTok, Shorts). Our renderer cuts the scenes together and draws every word itself: word-by-word captions of the voice with your key words standing out, on-screen lines, counting numbers, review cards, the price and the closing card, plus music and sound effects. You decide what each scene is, what is in it and what it says.
- Follow the VIDEO STORYLINE: scene 1 is kind "hook", the last is kind "cta", the middle uses the kinds it lists, in the order that tells the story best. 15–35 seconds in total.
- The first 2 seconds decide everything: open on the most striking picture with the hook line on screen ("overlay", at most ${LIMITS.overlayWords} words) and, when there's a voice, say the hook straight away. No greetings, no logo intro.
- One idea per scene. Change the picture every 2–5 seconds; a scene longer than 6 seconds needs a strong reason.
- Each scene:
  - kind: from the storyline.
  - source: the picture. A moment of the client's own video ("V3"), one of their real photos ("G2"), or "AI" (made from "visual"). Real footage and photos come first; AI only when nothing real fits. Use each V or G at most once per video. Pick moments whose length fits the scene.
  - voiceover: follow the SOUND line. Spoken and natural, about ${LIMITS.wordsPerSecond} words per second, 2–7 seconds per scene, short sentences. "" for talking moments (the person speaks) and in music-only videos.
  - seconds: null when the scene is voiced or a talking moment; the length (2–5) when nothing is spoken.
  - overlay: a short on-screen line (at most ${LIMITS.overlayWords} words) only when it adds what the voice doesn't say, or carries the message in music-only videos; otherwise "". The hook always has one.
  - keywords: 1–3 exact words from that scene's voiceover or overlay that matter most (the number, the product, the result); the renderer makes them stand out.
  - visual: what the camera sees: subject, setting, light, framing, and where calm space is for the words (top or bottom). For AI scenes it makes the picture; for real ones, describe what you picked. No text, letters, logos or anyone speaking in AI pictures.
  - motion: one camera move ("slow push in", "gentle pan left", "static").
  - sticker: a STICKERS name or null, on a scene where it adds meaning to a key word.
  - stat: only for kind "stat": { value (a number), label (up to 6 words), prefix ("$", "+"…), suffix ("%", "+", " stars"…), source (the fact label the number comes from) }. The number must be in that fact. Otherwise null.
  - review: only for kind "review": the label of the review to show ("R2"). Otherwise null.
  - price: true only on a product or offer scene when the price is in [O1] or [F1].
  - reveal / revealVisual: only for kind "reveal": "reveal" is the AFTER picture ("V…", "G…" or "AI" described in revealVisual); "source" is the BEFORE.
  - transition: how the cut into the next scene feels: "cut" (quick, keeps the pace), "smooth" (calm, flowing), "energetic" (a punchy change), "reveal" (into a result or the closing card).
- The "cta" scene: say the call to action (or "" when music only); its picture is a calm brand moment; the closing card is drawn over it.
- musicMood: a few words for the background music (e.g. "warm acoustic, upbeat").`,
  text: `FORMAT: text-only post. Put the full post in each platform's caption; the hook is the first line. No image.`,
};

export function creativeSystem(format: Format): string {
  return `${COMMON}

${FORMAT_RULES[format]}

Return JSON with these keys: message, hooks [{type, text}], chosenHook, framework, levers [{lever, source}], cta {label, link}, claims [{text, source}], captions {platform: text}, photo${
    format === "static" ? ", headline, subhead, badge {text, source} | null, imagePrompt, layout" : format === "carousel" ? ", slides [{title, body}], imagePrompt" : format === "video" ? ", scenes [{kind, source, voiceover, seconds, overlay, keywords, visual, motion, sticker, stat, review, price, reveal, revealVisual, transition}], musicMood" : ""
  }.`;
}

export function creativePrompt(book: string, platforms: string[], feedback: string[] | null, note: string | null): string {
  const parts = [book, "", `CAPTION KEYS: ${platforms.join(", ")}`];
  if (note) parts.push("", `THE CLIENT ASKED FOR THIS CHANGE: "${note}". Follow it unless it breaks the facts rules.`);
  if (feedback?.length) parts.push("", "YOUR LAST BRIEF WAS SENT BACK. Fix all of these:", ...feedback.map((f) => `- ${f}`));
  return parts.join("\n");
}
