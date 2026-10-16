import * as FFmpeg from "./client";

export interface StitchOptions {
  clipUrls: string[];
  audioUrl?: string | null;
  clipDurationSeconds?: number;
}

export async function submitSceneStitchJob({
  clipUrls,
  audioUrl,
  clipDurationSeconds = 4,
}: StitchOptions): Promise<string> {
  const hasAudio = !!audioUrl;
  const outputDuration = clipUrls.length * clipDurationSeconds;

  const videoInputFlags = clipUrls.map((_, i) => `-i {input${i}}`).join(" ");
  const audioInputFlag = hasAudio ? ` -i {input${clipUrls.length}}` : "";

  const filterParts: string[] = [];
  clipUrls.forEach((_, i) => {
    filterParts.push(
      `[${i}:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=24,tpad=stop_mode=clone:stop_duration=${clipDurationSeconds},trim=duration=${clipDurationSeconds},setpts=PTS-STARTPTS[v${i}]`
    );
  });
  const concatInputs = clipUrls.map((_, i) => `[v${i}]`).join("");
  filterParts.push(`${concatInputs}concat=n=${clipUrls.length}:v=1:a=0,format=yuv420p[v]`);
  if (hasAudio) filterParts.push(`[${clipUrls.length}:a]apad[aout]`);
  const filterComplex = filterParts.join(",");

  const audioMap = hasAudio ? `-map "[aout]" ` : "";
  const audioEncode = hasAudio ? `-c:a aac -b:a 192k -ar 44100 -ac 2 ` : `-an `;

  const command = `ffmpeg -y ${videoInputFlags}${audioInputFlag} -filter_complex "${filterComplex}" -map "[v]" ${audioMap}-t ${outputDuration.toFixed(2)} -c:v libx264 -preset superfast -crf 23 ${audioEncode}-avoid_negative_ts make_zero -movflags +faststart {output}`;

  return FFmpeg.submitJob({
    files: hasAudio ? [...clipUrls, audioUrl as string] : [...clipUrls],
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
