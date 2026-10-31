// ffmpeg jobs: the small video tasks (loudness, trimming, converting, thumbnails) and, until the
// Remotion templates replace it, joining clips into a video. Prodo sends the argument list.

import { spawn } from "node:child_process";
import { extname, join } from "node:path";
import { JOB_TIMEOUT_MS } from "./config.ts";
import { download, isStorageKey, uploadResult } from "./storage.ts";

export interface FfmpegInput {
  inputs: string[];
  args: string[];
  outputKey: string;
  contentType: string;
}

/** Runs ffmpeg with an argument list (never a shell string). */
export function runFfmpeg(args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: ["ignore", "ignore", "pipe"] });
    let stderr = "";
    proc.stderr.on("data", (chunk) => (stderr = (stderr + chunk).slice(-2000)));
    const timer = setTimeout(() => proc.kill("SIGKILL"), JOB_TIMEOUT_MS);
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
    proc.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(signal === "SIGKILL" ? "Render took longer than the time limit" : stderr.trim() || `ffmpeg exited with ${code}`));
    });
  });
}

/** Downloads the inputs into `dir`, runs ffmpeg and uploads the result. */
export async function runFfmpegJob(job: FfmpegInput, dir: string): Promise<void> {
  const localInputs = await Promise.all(
    job.inputs.map(async (input, i) => {
      const ext = extname(isStorageKey(input) ? input : new URL(input).pathname) || ".bin";
      const path = join(dir, `input${i}${ext}`);
      await download(input, path);
      return path;
    })
  );
  const output = join(dir, `output${extname(job.outputKey) || ".mp4"}`);

  // {input0}…{inputN} and {output} become local file paths; {dir} is the job's folder
  // (subtitles find the brand fonts there with fontsdir={dir})
  const args = job.args.map((arg) =>
    arg
      .replace(/\{input(\d+)\}/g, (_, n) => localInputs[Number(n)] ?? "")
      .replace(/\{output\}/g, output)
      .replace(/\{dir\}/g, dir)
  );

  await runFfmpeg(args);
  await uploadResult(output, job.outputKey, job.contentType);
}
