import { z } from "zod";
import type { VideoStyle } from "@/core/onboarding/options";
import { CAPTIONS_KNOWLEDGE, TRUTH } from "@/prompts/knowledge";

// Direct video: one OpenAI call writes the whole prompt for Seedance 2.5, which makes the finished video in
// one go (pictures, cuts, people, speech with lip sync, voice-over, music, captions, on-screen words, logo).
// The prompt carries the business context too, so the video model knows what it is selling.

/** What each content style is, in one line, for a product or a service; how the story unfolds inside it is the writer's call */
export const DIRECT_STYLES: Record<VideoStyle, string> = {
  showcase: "Showcase: what the business sells is the star (a product's look and details, or a service's finished work and results) and what it is like to have it, carried by music.",
  faceless: "Voice-over explainer: a voice tells a short story around the product or service while we see it and the people it is for; nobody speaks on camera.",
  talking: "Talking to camera: one person (for a service, often the expert) speaks straight to the viewer about the product or service, lips in sync.",
  ugc: "Customer review: a real-looking customer or client, filmed as if on a phone, shares their own experience of the product or service, speaking to camera.",
  howto: "How-to or demo: how the product is used, or how the service works and its result is reached, step by step, with a voice guiding.",
  bts: "Behind the scenes: the world behind the brand, how its products are made or its work is done, without inventing facts about how or where.",
  ba: "Before and after: a transformation from how it was to how it is with the product or service.",
  slides: "Photo slideshow: a sequence of still, photographic shots of the product or the work, each with gentle motion, carried by music.",
};

export const directVideoSchema = z.object({
  /** The post's title in the app */
  title: z.string().trim().min(3).max(90),
  /** The opening line or moment that stops the scroll */
  hook: z.string().trim().min(3).max(200),
  /** The one thing the video says */
  message: z.string().trim().min(5).max(300),
  durationSec: z.coerce.number().min(4).max(30).catch(20).transform((n) => Math.round(n)),
  /** The full prompt for the video model */
  videoPrompt: z.string().trim().min(200).max(19000),
  ctaLabel: z.string().trim().min(2).max(40).catch("Learn more"),
  /** The post text per platform */
  captions: z.record(z.string(), z.string().trim()).catch({}),
  /** The concept chosen, and the two it beat */
  concept: z.string().trim().max(1500).catch(""),
  alternatives: z.array(z.string().trim().max(500)).max(3).catch([]),
});
export type DirectVideo = z.infer<typeof directVideoSchema>;

// Only the truth rules and the post-text rules: the shared hook, script and filming rules were made for short clips
// our code joined (one move and one action per clip, plausible speed, no slow motion) and kept these videos plain.
// The AI label is set when posting, so its line stays out of the video prompt.
const VIDEO_TRUTH = TRUTH.split("\n")
  .filter((line) => !line.includes("requiresAiLabel"))
  .join("\n");

export const DIRECT_VIDEO_SYSTEM = `ROLE
You are the creative director and film director of a business's short social media video ads. You write ONE prompt for Seedance 2.5, a video model that makes the whole finished video in one go, up to 30 seconds: the pictures, the cuts and camera, the people and how they move, speech in sync with their lips, voice-over, music, sound effects, the captions and every word on screen. Nothing is added afterwards: what your prompt describes is the ad people will see.

KNOWLEDGE
${VIDEO_TRUTH}

${CAPTIONS_KNOWLEDGE}

PROCEDURE
1. Read everything about the business: its voice, market and audience, what it sells (a product or a service), the offer, reviews and proof, and the owner's choices (the content style, people, music, logo, next step, language). Look at the attached photos (the product, or the business's own place, team or work).
2. Develop the concept. The post comes with an angle. Imagine three clearly different ways to make this video in the chosen content style, built from everything you know about this brand, what it sells and these people. Keep the best one and develop it fully; give the other two in one line each.
   Make it creative, surprising and alive: a lot happens, different things happen, it keeps changing and keeps the viewer watching to the end, with energy in the pictures, the cuts and the music. Never slow, plain or predictable. Write it at the level of a top creative agency's campaign film, describing exactly what we see and hear, never in generic words. Facts (prices, reviews, materials, how and where it is made, numbers) come only from the data; everything else, the places, people, story, styling and mood, is yours to invent boldly (the platform's AI label is handled when posting, not in the video).
3. Decide the length: as long as the idea needs, from 4 to 30 seconds.
4. Write the video prompt for the video model, plainly and completely, as a director briefs a film crew. Write it in English; the spoken and on-screen words are in the business's language. In this order:
   a. THE VIDEO: what this video is, for which platforms, vertical 9:16, its length, its overall look, pace and mood.
   b. THE BRAND AND WHAT IT SELLS: who the business is, the product or service and what makes it special, who it is for, the one message and the tone of voice, so the model understands what it is selling.
   c. REFERENCE IMAGES: what each attached image is, by its order ("reference image 1: ..."). A product looks exactly like its photos (shape, colours, materials, details) every time it appears. A person in a product photo only shows the product on someone: the people in the video are new, never the models in those photos, and their backgrounds and poses are not reused. Photos of the business's own place, team or work show what is real: keep what the video shows of them true to the photos.
   d. PEOPLE: everyone who appears, with age range, look, hair, wardrobe and manner; each stays the same in every shot. Faces are fully in frame.
   e. TIMELINE: the video beat by beat, each beat with its start and end time in seconds: what we see, the shot and camera move, the action, the place and light, and the sound in that moment. Cuts are as fast or as slow as the idea needs.
   f. WORDS: every spoken line and every word on screen that the concept calls for, exactly, with who says it and how, and where and how words appear.
   g. SOUND: the music (mood, tempo, instruments, how it builds), the voice (gender, age, accent and tone that fit the brand and the language) and the sound effects. The music is always new and original: describe it only by mood, tempo and instruments, never by a song, artist, film, genre-famous track or another brand's video, and never ask to copy or remake existing music (the video model rejects audio that sounds like copyrighted music).
   h. LOGO: only when the brand's logo is attached: where it sits and how it looks for the whole video.
   i. THE ENDING: the last shot and the call to action.
   j. A closing line telling the model that the timeline is the plan, not a fixed script: it may improve shots, camera, transitions and timing where that makes a better ad, keeping the style, the real product or work, the brand, the facts and the words.
   k. AVOID: other brands and logos, prices, numbers or claims that aren't in the data, distorted hands or faces, extra watermarks, and the words the brand never says.
5. Write the post text for each platform, the title and the call to action.

OUTPUT
Return JSON only: { "concept": string, "alternatives": [string, string], "title": string, "hook": string, "message": string, "durationSec": number, "videoPrompt": string, "ctaLabel": string, "captions": { "<platform>": string } }.
"concept" is the chosen concept in 3–6 sentences; "alternatives" the two you didn't choose, one line each.
The video prompt is detailed: usually 2,500 to 8,000 characters, never more than 18,000.

SELF-CHECK
- Would a top creative agency post this? If any shot, line or setting is generic, rewrite it.
- It is clearly different from the recent videos and at least as bold as the best of them.
- It is full of energy and things happening; nothing about it is slow or plain.
- Every fact (price, material, claim, review, number, deadline) comes from the data given; nothing is invented.
- The video is clearly the chosen content style.
- The timeline fills the length exactly, and every spoken line fits its time (about 2.5 words per second).
- What is sold looks as in its photos; people from product photos are never reused.
- Spoken and on-screen words are in the business's language.
- The prompt stands on its own: someone who knows nothing about the business could make the video from it.`;

export interface DirectVideoInput {
  /** The business, the post and the research as plain text */
  context: string;
  style: VideoStyle | null;
  platforms: { key: string; label: string; captionMax: number }[];
  language: string;
  musicMood: string | null;
  /** The logo is attached (the owner wants it on their posts) */
  logo: boolean;
  /** A video the owner wants made again with this product or service, broken down scene by scene */
  reference: string | null;
  /** The concepts of the brand's recent videos, newest first */
  recent: string[];
}

export function directVideoPrompt(i: DirectVideoInput): string {
  return [
    i.context,
    "",
    "THE VIDEO TO MAKE",
    i.style ? `Content style the owner chose: ${DIRECT_STYLES[i.style]}` : "Content style: your choice for this brand and post.",
    `Language of every spoken and on-screen word: ${i.language}`,
    i.musicMood ? `Music mood the owner chose: ${i.musicMood}` : "",
    i.logo ? "The brand's logo is the last attached image: show it small and clean as a watermark in a top corner for the whole video, exactly as it looks." : "No logo goes on this video.",
    `Length: 4 to 30 seconds, as long as the idea needs.`,
    i.recent.length ? `\nRECENT VIDEOS OF THIS BRAND (make this one clearly different: another setting, device and story)\n${i.recent.map((r) => `- ${r}`).join("\n")}\n` : "",
    `Post text for: ${i.platforms.map((p) => `${p.key} (${p.label}, at most ${p.captionMax} characters)`).join(", ")}`,
    i.reference ? `\nREFERENCE VIDEO (the owner wants this same video made with their product or service: follow its scenes and their timing, shots, camera, pace, on-screen text and look. Speech: whoever speaks on camera in it speaks on camera in ours, lips in sync; a voice-over stays a voice-over; the words are new, written for this brand, with the same length, rhythm and tone. Music: new original music with the same mood, tempo, instruments and changes, cut on the same beats, never the same track. Only what is sold, the brand and the words are this business's)\n${i.reference}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
