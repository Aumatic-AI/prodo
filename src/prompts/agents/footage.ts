import { z } from "zod";

// The client's own videos, logged like an editor would: the usable moments with times, what each
// shows, whether someone speaks to camera (and what they say), where the subject is and where text
// can go. Twelve Labs Pegasus reads the video itself. The Creative Director then picks moments for
// scenes, and our renderer cuts them in and places text from these fields.

export const MOMENT_SHOTS = ["close-up", "medium", "wide", "detail", "screen"] as const;
export const MOMENT_PEOPLE = ["none", "hands", "person", "group"] as const;
export const MOMENT_USES = ["hook", "broll", "testimonial", "demo", "result", "process", "place", "product"] as const;
export const ZONES = ["top", "middle", "bottom"] as const;

const seconds = z.coerce.number().min(0).max(3600);

const momentSchema = z.object({
  start: seconds,
  end: seconds,
  shows: z.string().trim().min(3).max(200),
  shot: z.enum(MOMENT_SHOTS).catch("medium"),
  people: z.enum(MOMENT_PEOPLE).catch("none"),
  talking: z.boolean().catch(false),
  product: z.boolean().catch(false),
  quality: z.coerce.number().int().min(1).max(5).catch(3),
  use: z.enum(MOMENT_USES).catch("broll"),
  /** Where the main subject is (horizontal, vertical) */
  subject: z.object({ x: z.enum(["left", "center", "right"]).catch("center"), y: z.enum(ZONES).catch("middle") }).catch({ x: "center", y: "middle" }),
  /** A calm area where text can go without covering the subject, or none */
  textArea: z.enum([...ZONES, "none"]).catch("bottom"),
  /** Spoken words with their times (only when someone talks) */
  lines: z.array(z.object({ start: seconds, end: seconds, text: z.string().trim().min(1).max(300) })).max(20).catch([]),
});
export type FootageMoment = z.infer<typeof momentSchema>;

export const footageSchema = z.object({
  duration: seconds,
  summary: z.string().trim().max(400).catch(""),
  /** Whether the video is upright (9:16), square or wide */
  orientation: z.enum(["vertical", "square", "horizontal"]).catch("vertical"),
  moments: z
    .array(z.unknown())
    .transform((list) =>
      list
        .flatMap((m) => {
          const parsed = momentSchema.safeParse(m);
          return parsed.success && parsed.data.end - parsed.data.start >= 1 ? [parsed.data] : [];
        })
        .slice(0, 10)
    ),
});
export type FootageAnalysis = z.infer<typeof footageSchema>;

const ZONE = { type: "string", enum: [...ZONES] };

/** JSON schema sent to Twelve Labs so the answer comes back in this shape. */
export const FOOTAGE_JSON_SCHEMA = {
  type: "object",
  properties: {
    duration: { type: "number" },
    summary: { type: "string" },
    orientation: { type: "string", enum: ["vertical", "square", "horizontal"] },
    moments: {
      type: "array",
      items: {
        type: "object",
        properties: {
          start: { type: "number" },
          end: { type: "number" },
          shows: { type: "string" },
          shot: { type: "string", enum: [...MOMENT_SHOTS] },
          people: { type: "string", enum: [...MOMENT_PEOPLE] },
          talking: { type: "boolean" },
          product: { type: "boolean" },
          quality: { type: "integer" },
          use: { type: "string", enum: [...MOMENT_USES] },
          subject: { type: "object", properties: { x: { type: "string", enum: ["left", "center", "right"] }, y: ZONE }, required: ["x", "y"] },
          textArea: { type: "string", enum: [...ZONES, "none"] },
          lines: { type: "array", items: { type: "object", properties: { start: { type: "number" }, end: { type: "number" }, text: { type: "string" } }, required: ["start", "end", "text"] } },
        },
        required: ["start", "end", "shows", "shot", "people", "talking", "product", "quality", "use", "subject", "textArea", "lines"],
      },
    },
  },
  required: ["duration", "summary", "orientation", "moments"],
};

export function footagePrompt(business: string): string {
  return `You are logging raw footage for a video editor who cuts short social media ads for this business: ${business}

List the usable moments of this video, the way an editor marks clips: up to 8 moments, each 2–15 seconds, in time order, that could stand alone as one scene of an ad. Skip shaky, blurry, dark or empty stretches.

For each moment:
- start, end: seconds from the start of the video
- shows: one plain line on what is on screen (e.g. "close-up of hands pouring candle wax into a glass jar")
- shot: close-up, medium, wide, detail or screen (a phone or computer screen recording)
- people: none, hands, person or group
- talking: true only when someone speaks to the camera in this moment
- product: true when the product or the finished result of the service is clearly visible
- quality: 1–5 (5 = sharp, steady, well lit, good framing)
- use: what an editor would use it for: hook (striking opening), broll, testimonial (a customer talking), demo, result, process, place or product
- subject: where the main subject sits in the frame: x left/center/right, y top/middle/bottom
- textArea: a calm part of the frame where words could be added without covering the subject or a face: top, middle, bottom, or none
- lines: when someone talks, their words with start and end seconds (quote them exactly); otherwise an empty list

Also give the video's total duration in seconds, its orientation (vertical, square or horizontal) and a one-sentence summary. Describe only what is really in the video.`;
}
