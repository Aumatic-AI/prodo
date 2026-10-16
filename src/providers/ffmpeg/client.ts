import { env } from "@/config/env";

const API_URL = "https://api.upload-post.com/api/uploadposts/ffmpeg";

function getHeaders() {
  const key = env.UPLOAD_POST_API_KEY;
  if (!key) throw new Error("UPLOAD_POST_API_KEY is not set (needed for FFmpeg API)");
  return { "Content-Type": "application/json", Authorization: key };
}

export interface FFmpegJobStatus {
  status: "pending" | "finished" | "failed" | "error";
  url?: string;
  error?: string;
}

export async function submitJob(opts: {
  files: string[];
  command: string;
  outputExtension?: string;
}): Promise<string> {
  const res = await fetch(`${API_URL}/jobs/upload`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      files: opts.files,
      full_command: opts.command,
      output_extension: opts.outputExtension || "mp4",
    }),
  });
  if (!res.ok) throw new Error(`FFmpeg submit failed: ${res.status} ${res.statusText}`);
  const data = await res.json();
  if (!data.job_id) throw new Error("FFmpeg API did not return a job_id");
  return data.job_id;
}

export async function checkStatus(jobId: string): Promise<FFmpegJobStatus> {
  const res = await fetch(`${API_URL}/jobs/${jobId}`, { headers: getHeaders() });
  if (!res.ok) throw new Error(`FFmpeg status check failed: ${res.status}`);

  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    return { status: "finished", url: res.url };
  }

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { status: "finished", url: res.url };
  }

  if (data.status === "finished") {
    const dlRes = await fetch(`${API_URL}/jobs/${jobId}/download`, { headers: getHeaders() });
    if (!dlRes.ok) throw new Error("Job finished but download URL retrieval failed");
    const dlContentType = dlRes.headers.get("content-type") || "";
    if (!dlContentType.includes("application/json")) return { status: "finished", url: dlRes.url };
    const dlData = await dlRes.json();
    return { status: "finished", url: dlData.url || dlData.download_url || dlData.file_url || dlRes.url };
  }

  return { status: data.status, error: data.error };
}

export function downloadHeaders() {
  return getHeaders();
}
