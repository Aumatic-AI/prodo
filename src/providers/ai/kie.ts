import { env } from "@/config/env";

const API_BASE = "https://api.kie.ai/api/v1/jobs";

function getKey() {
  if (!env.KIE_API_KEY) throw new Error("KIE_API_KEY is not set");
  return env.KIE_API_KEY;
}

export async function createImageTask(
  prompt: string,
  imageSize: "9:16" | "4:5" | "16:9" | "1:1" = "4:5"
): Promise<string> {
  const res = await fetch(`${API_BASE}/createTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({
      model: "google/nano-banana",
      input: { prompt, output_format: "png", image_size: imageSize },
    }),
  });
  if (!res.ok) throw new Error(`Kie API error: ${await res.text()}`);
  const data = await res.json();
  const jobId = data.taskId || data.jobId || data.id || data.data?.taskId || data.data?.jobId || data.data?.id;
  if (!jobId) throw new Error(`No jobId from Kie: ${JSON.stringify(data)}`);
  return jobId;
}

export async function createVideoTask(
  prompt: string,
  imageUrls: string[],
  aspectRatio = "9:16",
  duration = "4"
): Promise<string> {
  const res = await fetch(`${API_BASE}/createTask`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getKey()}` },
    body: JSON.stringify({
      model: "bytedance/seedance-1.5-pro",
      input: { prompt, input_urls: imageUrls, aspect_ratio: aspectRatio, duration },
    }),
  });
  if (!res.ok) throw new Error(`Kie API error: ${await res.text()}`);
  const data = await res.json();
  const jobId = data.taskId || data.jobId || data.id || data.data?.taskId || data.data?.jobId || data.data?.id;
  if (!jobId) throw new Error(`No jobId from Kie: ${JSON.stringify(data)}`);
  return jobId;
}

export interface TaskStatus {
  state: "waiting" | "queuing" | "generating" | "success" | "fail";
  resultJson: string;
  failMsg?: string;
  failCode?: string;
}

export async function checkTaskStatus(jobId: string): Promise<TaskStatus> {
  const res = await fetch(`${API_BASE}/recordInfo?taskId=${jobId}`, {
    headers: { Authorization: `Bearer ${getKey()}` },
  });
  const response = await res.json();
  return response.data || {};
}

export function parseResultUrl(resultJson: string): string | null {
  try {
    const parsed = JSON.parse(resultJson);
    return parsed.resultUrls?.[0] || parsed.urls?.[0] || null;
  } catch {
    return null;
  }
}
