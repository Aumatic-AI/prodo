import { submitJob } from "./client";

export interface StitchOptions {
  /** Kie clip URLs, in scene order */
  clipUrls: string[];
  /** Length of each scene in seconds (its narration length). Clips are padded or trimmed to it. */
  clipDurations: number[];
  /** Storage key of each scene's voice-over, same order. Omit for a silent video. */
  audioKeys?: string[] | null;
  outputKey: string;
}

/** Joins scene clips and their voice-overs into one 1080x1920 video. Returns the worker job id. */
export function submitSceneStitchJob({ clipUrls, clipDurations, audioKeys, outputKey }: StitchOptions): Promise<string> {
  const n = clipUrls.length;
  const hasAudio = !!audioKeys?.length;
  const total = clipDurations.reduce((sum, d) => sum + d, 0);

  const filters: string[] = clipUrls.map((_, i) => {
    const d = clipDurations[i];
    return `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,tpad=stop_mode=clone:stop_duration=${d},trim=duration=${d},setpts=PTS-STARTPTS[v${i}]`;
  });
  filters.push(`${clipUrls.map((_, i) => `[v${i}]`).join("")}concat=n=${n}:v=1:a=0,format=yuv420p[v]`);

  if (hasAudio) {
    audioKeys!.forEach((_, i) => {
      filters.push(`[${n + i}:a]apad,atrim=duration=${clipDurations[i]},asetpts=PTS-STARTPTS[a${i}]`);
    });
    filters.push(`${audioKeys!.map((_, i) => `[a${i}]`).join("")}concat=n=${n}:v=0:a=1[aout]`);
  }

  const inputs = hasAudio ? [...clipUrls, ...audioKeys!] : [...clipUrls];
  const args = [
    ...inputs.flatMap((_, i) => ["-i", `{input${i}}`]),
    "-filter_complex", filters.join(","),
    "-map", "[v]",
    ...(hasAudio ? ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ar", "44100", "-ac", "2"] : ["-an"]),
    "-t", total.toFixed(2),
    "-c:v", "libx264", "-preset", "superfast", "-crf", "23",
    "-avoid_negative_ts", "make_zero",
    "-movflags", "+faststart",
    "{output}",
  ];

  return submitJob({ inputs, args, outputKey, contentType: "video/mp4" });
}
