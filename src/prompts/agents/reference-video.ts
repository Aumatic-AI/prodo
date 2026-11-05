import { z } from "zod";

// A video the owner wants made again for their own product, broken down the way an editor would:
// every scene with its times, what it shows and how it is filmed, the words on screen and the words
// said, the cut to the next scene, and the sound, pacing and look of the whole. Twelve Labs Pegasus
// watches it once; the Creative Director then makes the same video with this business's product.

const seconds = z.coerce.number().min(0).max(3600);
const text = (max: number) => z.string().trim().max(max).catch("");

const sceneSchema = z.object({
  start: seconds,
  end: seconds,
  shows: text(300),
  shot: text(80),
  camera: text(160),
  people: text(160),
  action: text(240),
  onScreenText: text(200),
  textPosition: text(60),
  textStyle: text(160),
  spoken: text(400),
  transition: text(100),
  purpose: text(100),
});
export type ReferenceScene = z.infer<typeof sceneSchema>;

export const referenceVideoSchema = z.object({
  duration: seconds,
  summary: text(600),
  format: text(240),
  pacing: text(300),
  look: text(300),
  sound: z.object({ voice: text(240), music: text(240), effects: text(240) }).catch({ voice: "", music: "", effects: "" }),
  captions: text(240),
  ending: text(240),
  /** Every spoken line with its time and who says it (Twelve Labs listens) */
  speech: z.array(z.object({ start: seconds, end: seconds, speaker: text(120), text: text(400) })).catch([]),
  scenes: z
    .array(z.unknown())
    .catch([])
    .transform((list) =>
      list
        .flatMap((s) => {
          const parsed = sceneSchema.safeParse(s);
          return parsed.success && parsed.data.end > parsed.data.start ? [parsed.data] : [];
        })
        .sort((a, b) => a.start - b.start)
        .slice(0, 40)
    ),
});
export type ReferenceVideo = z.infer<typeof referenceVideoSchema>;

const STR = { type: "string" };

/** JSON schema sent to Twelve Labs so the answer comes back in this shape. */
export const REFERENCE_VIDEO_JSON_SCHEMA = {
  type: "object",
  properties: {
    duration: { type: "number" },
    summary: STR,
    format: STR,
    pacing: STR,
    look: STR,
    sound: { type: "object", properties: { voice: STR, music: STR, effects: STR }, required: ["voice", "music", "effects"] },
    captions: STR,
    ending: STR,
    speech: { type: "array", items: { type: "object", properties: { start: { type: "number" }, end: { type: "number" }, speaker: STR, text: STR }, required: ["start", "end", "speaker", "text"] } },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: "number" },
          end: { type: "number" },
          shows: STR,
          shot: STR,
          camera: STR,
          people: STR,
          action: STR,
          onScreenText: STR,
          textPosition: STR,
          textStyle: STR,
          spoken: STR,
          transition: STR,
          purpose: STR,
        },
        required: ["start", "end", "shows", "shot", "camera", "people", "action", "onScreenText", "textPosition", "textStyle", "spoken", "transition", "purpose"],
      },
    },
  },
  required: ["duration", "summary", "format", "pacing", "look", "sound", "captions", "ending", "speech", "scenes"],
};

export function referenceVideoPrompt(): string {
  return `You are breaking down a short social media video for an editor who will remake it, scene by scene, for a different business and its product. Watch all of it, picture and sound.

Return:
- duration: its length in seconds.
- summary: what the video is and how it works, in two or three sentences.
- format: what kind of video it is and how it is made.
- pacing: how fast it cuts, and how that changes through the video.
- look: colour, light, filming style and editing style.
- sound: voice (who speaks, on camera or as a voice-over, and how they sound; "none" when nobody speaks), music (its mood, tempo in beats per minute, instruments, where it builds, drops or changes, and whether the cuts follow the beat; "none" when there is none), effects (the sound effects and where they come; "none" when there are none).
- captions: whether the spoken words are shown on screen, how they look and where they sit; "none" when they aren't.
- ending: how it ends (the last picture, a call to action, a logo or an end card).
- speech: every spoken line in order, with start and end (seconds), speaker (who says it, and whether they speak on camera with their lips moving or as a voice-over) and text (the exact words); an empty list when nobody speaks.
- scenes: every scene in order, one per cut, with no gaps, from the first frame to the last:
  start and end (seconds), shows (what is in the picture), shot (how close the camera is), camera (how it moves), people (who is in it and how they look, or "none"), action (what happens), onScreenText (the exact words shown, or ""), textPosition (where they sit on screen, or ""), textStyle (how they look and appear, or ""), spoken (the words said in this scene, or ""), transition (how it cuts to the next scene), purpose (what the scene does for the video).`;
}

/** What the frames show (OpenAI vision on timed contact sheets): the exact shots, the words on screen and the look. */
export const referenceShotsSchema = z.object({
  look: text(300),
  captions: text(240),
  ending: text(240),
  scenes: referenceVideoSchema.shape.scenes,
});
export type ReferenceShots = z.infer<typeof referenceShotsSchema>;

export function referenceShotsPrompt(duration: number, every: number, sheets: number): string {
  return `The ${sheets} attached contact sheet${sheets === 1 ? "" : "s"} show one frame every ${every} seconds of a ${duration}-second social media video, in order (left to right, top to bottom, sheet after sheet), each frame labelled with its time.

Break the video into scenes the way an editor logs a cut list: a new scene starts where the picture changes to a different shot. For each scene give:
- start and end in seconds, from the frame times (the first starts at 0, the last ends at ${duration})
- shows: what is in the picture
- shot: how close the camera is
- camera: how it moves (judge from the change between frames: push-in, pull-out, pan, tilt, still, handheld)
- people: who is in it and how they look (hair, clothes, accessories, expression), or "none"
- action: what happens
- onScreenText: the exact words on screen, or ""
- textPosition and textStyle: where those words sit and how they look, or ""
- transition: how it changes to the next scene (cut, dissolve, wipe, match cut, whip)
- purpose: what the scene does for the video
- spoken: ""

Also give: look (colours, light, set, styling and colour grade), captions (whether spoken words appear on screen as captions, their style and place, or "none") and ending (the last picture, an end card or a logo).

Describe only what you see. Return JSON: { "look": string, "captions": string, "ending": string, "scenes": [{ "start": number, "end": number, "shows": string, "shot": string, "camera": string, "people": string, "action": string, "onScreenText": string, "textPosition": string, "textStyle": string, "spoken": string, "transition": string, "purpose": string }] }`;
}

/**
 * One breakdown from the two readings, each trusted only for what it does best, so the prompt writer never sees
 * two versions of the same thing: the frames give the shots, their times, the words on screen and the look;
 * Twelve Labs gives the summary, pacing and all the sound, and its spoken lines are placed in the scenes by time.
 */
export function mergeReference(heard: ReferenceVideo, seen: ReferenceShots | null): ReferenceVideo {
  if (!seen?.scenes.length) return heard;
  const scenes = seen.scenes.map((s) => ({
    ...s,
    spoken: heard.speech
      .filter((l) => l.start < s.end && l.end > s.start)
      .map((l) => (l.speaker ? `${l.speaker}: ${l.text}` : l.text))
      .join(" "),
  }));
  return { ...heard, look: seen.look || heard.look, captions: seen.captions || heard.captions, ending: seen.ending || heard.ending, scenes };
}
