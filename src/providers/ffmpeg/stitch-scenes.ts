import * as FFmpeg from "./client";

export interface StitchOptions {
  clipUrls: string[];
  /** One duration (seconds) per clip, same order as clipUrls — each scene's
   * own measured narration length, not a flat guess. This is what every
   * clip gets forced to (freeze-padded if the generated clip came back
   * shorter, trimmed if longer), so the merged video can never cut off
   * mid-script the way a single shared duration did. */
  clipDurations: number[];
  /** One narration clip per scene, same order as clipUrls. Omit/null for a
   * silent video. */
  audioUrls?: string[] | null;
}

export async function submitSceneStitchJob({
  clipUrls,
  clipDurations,
  audioUrls,
}: StitchOptions): Promise<string> {
  const hasAudio = !!audioUrls && audioUrls.length > 0;
  const n = clipUrls.length;
  const outputDuration = clipDurations.reduce((sum, d) => sum + d, 0);

  const videoInputFlags = clipUrls.map((_, i) => `-i {input${i}}`).join(" ");
  const audioInputFlags = hasAudio ? audioUrls!.map((_, i) => ` -i {input${n + i}}`).join("") : "";

  const filterParts: string[] = [];
  clipUrls.forEach((_, i) => {
    const d = clipDurations[i];
    filterParts.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,tpad=stop_mode=clone:stop_duration=${d},trim=duration=${d},setpts=PTS-STARTPTS[v${i}]`
    );
  });
  const videoConcatInputs = clipUrls.map((_, i) => `[v${i}]`).join("");
  filterParts.push(`${videoConcatInputs}concat=n=${n}:v=1:a=0,format=yuv420p[v]`);

  if (hasAudio) {
    audioUrls!.forEach((_, i) => {
      const d = clipDurations[i];
      filterParts.push(`[${n + i}:a]apad,atrim=duration=${d},asetpts=PTS-STARTPTS[a${i}]`);
    });
    const audioConcatInputs = audioUrls!.map((_, i) => `[a${i}]`).join("");
    filterParts.push(`${audioConcatInputs}concat=n=${n}:v=0:a=1[aout]`);
  }
  const filterComplex = filterParts.join(",");

  const audioMap = hasAudio ? `-map "[aout]" ` : "";
  const audioEncode = hasAudio ? `-c:a aac -b:a 192k -ar 44100 -ac 2 ` : `-an `;

  const command = `ffmpeg -y ${videoInputFlags}${audioInputFlags} -filter_complex "${filterComplex}" -map "[v]" ${audioMap}-t ${outputDuration.toFixed(2)} -c:v libx264 -preset superfast -crf 23 ${audioEncode}-avoid_negative_ts make_zero -movflags +faststart {output}`;

  return FFmpeg.submitJob({
    files: hasAudio ? [...clipUrls, ...audioUrls!] : [...clipUrls],
    command,
    outputExtension: "mp4",
  });
}

export async function downloadAndStore(
  supabase: any,
  sourceUrl: string,
  storagePath: string
): Promise<{ publicUrl: string; sizeBytes: number }> {
  const res = await fetch(sourceUrl, { headers: FFmpeg.downloadHeaders() });
  if (!res.ok) throw new Error(`Failed to download stitched video: ${res.status}`);
  const buffer = await res.arrayBuffer();

  const { error } = await supabase.storage
    .from("media")
    .upload(storagePath, buffer, { contentType: "video/mp4" });
  if (error) throw new Error("Video upload failed: " + error.message);

  const { data } = supabase.storage.from("media").getPublicUrl(storagePath);
  return { publicUrl: data.publicUrl, sizeBytes: buffer.byteLength };
}
