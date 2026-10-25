import { renderBackend, submitJob } from "./client";

// The Producer's finished video in one ffmpeg run on our worker:
// scene clips (filled and cropped to the canvas) → burned-in captions and hook (ASS + brand font)
// → end card → voice-over with music underneath → loudness normalised to -14 LUFS.
// Built as an argument list; no shell is ever involved.

export interface ComposeOptions {
  width: number;
  height: number;
  /** Clip URLs in scene order */
  clipUrls: string[];
  /** Length of each scene in seconds; clips are padded or trimmed to it */
  sceneDurations: number[];
  /** Storage keys of each scene's voice-over, same order (or none) */
  voiceKeys?: string[] | null;
  /** Storage key of the music bed */
  musicKey?: string | null;
  /** Storage key of the .ass captions file */
  subtitlesKey?: string | null;
  /** Storage keys of .ttf fonts the captions use */
  fontKeys?: string[];
  /** Storage key of the end card PNG */
  endCardKey?: string | null;
  endCardSec?: number;
  /** Captions inside the filter graph with the brand fonts ({dir}). False (Upload-Post): left out here and burned in afterwards */
  captionsInGraph?: boolean;
  outputKey: string;
}

const FPS = 30;

export function buildComposeJob(o: ComposeOptions): { inputs: string[]; args: string[]; captionsKey: string | null } {
  const inputs: string[] = [];
  const args: string[] = [];
  /** Adds a worker input and returns its {inputN} placeholder */
  const file = (key: string) => {
    inputs.push(key);
    return `{input${inputs.length - 1}}`;
  };
  let streams = 0;
  /** Adds an ffmpeg -i input and returns its stream index */
  const media = (key: string, before: string[] = []) => {
    args.push(...before, "-i", file(key));
    return streams++;
  };

  const { width: W, height: H } = o;
  const endSec = o.endCardKey ? (o.endCardSec ?? 2.5) : 0;
  const main = o.sceneDurations.reduce((a, b) => a + b, 0);
  const total = main + endSec;

  const clips = o.clipUrls.map((url) => media(url));
  const voices = (o.voiceKeys ?? []).map((key) => media(key));
  const music = o.musicKey ? media(o.musicKey) : null;
  const endCard = o.endCardKey ? media(o.endCardKey, ["-loop", "1", "-t", endSec.toFixed(2)]) : null;
  const inGraph = o.captionsInGraph !== false;
  const subs = o.subtitlesKey && inGraph ? file(o.subtitlesKey) : null;
  if (subs) (o.fontKeys ?? []).forEach((key) => file(key));

  const f: string[] = [];
  clips.forEach((s, i) => {
    const d = o.sceneDurations[i].toFixed(2);
    f.push(
      `[${s}:v]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},setsar=1,fps=${FPS},tpad=stop_mode=clone:stop_duration=${d},trim=duration=${d},setpts=PTS-STARTPTS[v${i}]`
    );
  });
  f.push(`${clips.map((_, i) => `[v${i}]`).join("")}concat=n=${clips.length}:v=1:a=0[vmain]`);
  // fontsdir: the worker's job folder, where the brand fonts were downloaded
  f.push(subs ? `[vmain]subtitles=${subs}:fontsdir={dir}[vsub]` : `[vmain]null[vsub]`);
  if (endCard !== null) {
    f.push(`[${endCard}:v]scale=${W}:${H},setsar=1,fps=${FPS},format=yuv420p,fade=t=in:st=0:d=0.35[vend]`);
    f.push(`[vsub][vend]concat=n=2:v=1:a=0,format=yuv420p[vout]`);
  } else {
    f.push(`[vsub]format=yuv420p[vout]`);
  }

  let audio: string | null = null;
  if (voices.length) {
    voices.forEach((s, i) => f.push(`[${s}:a]apad,atrim=duration=${o.sceneDurations[i].toFixed(2)},asetpts=PTS-STARTPTS[a${i}]`));
    f.push(`${voices.map((_, i) => `[a${i}]`).join("")}concat=n=${voices.length}:v=0:a=1,apad=whole_dur=${total.toFixed(2)}[voice]`);
    audio = "[voice]";
  }
  if (music !== null) {
    const fadeAt = Math.max(0, total - 1.2).toFixed(2);
    // Music sits well under the voice; louder when there's no voice
    f.push(`[${music}:a]volume=${voices.length ? 0.14 : 0.6},atrim=duration=${total.toFixed(2)},afade=t=in:d=0.6,afade=t=out:st=${fadeAt}:d=1.2,asetpts=PTS-STARTPTS[music]`);
    if (audio) {
      f.push(`${audio}[music]amix=inputs=2:duration=first:dropout_transition=0:normalize=0[mix]`);
      audio = "[mix]";
    } else {
      audio = "[music]";
    }
  }
  if (audio) f.push(`${audio}loudnorm=I=-14:TP=-1.5:LRA=11,aresample=44100[aout]`);

  args.push(
    "-filter_complex",
    f.join(";"),
    "-map",
    "[vout]",
    ...(audio ? ["-map", "[aout]", "-c:a", "aac", "-b:a", "192k", "-ac", "2"] : ["-an"]),
    "-t",
    total.toFixed(2),
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "21",
    "-r",
    String(FPS),
    "-movflags",
    "+faststart",
    "{output}"
  );
  return { inputs, args, captionsKey: inGraph ? null : (o.subtitlesKey ?? null) };
}

export function submitComposeJob(o: ComposeOptions): Promise<string> {
  const { inputs, args, captionsKey } = buildComposeJob({ ...o, captionsInGraph: o.captionsInGraph ?? renderBackend().captionsInGraph });
  return submitJob({ inputs, args, outputKey: o.outputKey, contentType: "video/mp4", captionsKey });
}
