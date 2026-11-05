// How videos are made.
// "direct" (now): one OpenAI call writes the whole video prompt from the business context, the post and the
// owner's choices; then Seedance 2.5 on Kie makes the finished video in one go (picture, cuts, speech with lip
// sync, voice-over, music, captions and the logo), up to 30 seconds. No scenes, no Remotion, no worker, no QA.
// "scenes": the earlier pipeline (Creative Director scenes, AI clips, voice, music, Remotion on the worker).

export const VIDEO_MODE: "direct" | "scenes" = "direct";

export const isDirectVideo = (format: string): boolean => format === "video" && VIDEO_MODE === "direct";

/**
 * Seedance 2.5 settings. On Kie 720p costs about $0.315 per second of video (a 30-second video about $9.45),
 * 480p $0.14 and 1080p $0.79 per second. Every platform gets the one vertical video.
 */
export const DIRECT_VIDEO = {
  resolution: "480p" as "480p" | "720p" | "1080p",
  aspectRatio: "9:16",
  minSeconds: 4,
  maxSeconds: 30,
  /** Product photos sent as references, besides the logo */
  maxPhotos: 4,
};
