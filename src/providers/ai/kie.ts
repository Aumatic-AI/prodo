import { env } from "@/config/env";

const API_BASE = "https://api.kie.ai/api/v1/jobs";

function getKey() {
  if (!env.KIE_API_KEY) throw new Error("KIE_API_KEY is not set");
  return env.KIE_API_KEY;
}

export type KieAspectRatio = "1:1" | "2:3" | "3:2" | "9:16" | "16:9" | "21:9" | "auto";

export async function createImageTask(
  prompt: string,
  aspectRatio: KieAspectRatio = "2:3",
  referenceImageUrls?: string[],
  resolution: "1K" | "2K" | "4K" = "2K",
): Promise<string> {
  const input: Record<string, any> = {
    prompt,
    output_format: "png",
    aspect_ratio: aspectRatio,
    resolution,
    image_input: referenceImageUrls && referenceImageUrls.length > 0 ? referenceImageUrls : [],
  };
  const res = await fetch(`${API_BASE}/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({ model: "nano-banana-2", input }),
  });
  if (!res.ok) throw new Error(`Kie API error: ${await res.text()}`);
  const data = await res.json();
  const jobId =
    data.taskId ||
    data.jobId ||
    data.id ||
    data.data?.taskId ||
    data.data?.jobId ||
    data.data?.id;
  if (!jobId) throw new Error(`No jobId from Kie: ${JSON.stringify(data)}`);
  return jobId;
}

export async function createVideoTask(
  prompt: string,
  imageUrls: string[],
  aspectRatio = "9:16",
  duration = "4",
): Promise<string> {
  const res = await fetch(`${API_BASE}/createTask`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getKey()}`,
    },
    body: JSON.stringify({
      model: "bytedance/seedance-1.5-pro",
      input: {
        prompt,
        input_urls: imageUrls,
        aspect_ratio: aspectRatio,
        duration,
      },
    }),
  });
  if (!res.ok) throw new Error(`Kie API error: ${await res.text()}`);
  const data = await res.json();
  const jobId =
    data.taskId ||
    data.jobId ||
    data.id ||
    data.data?.taskId ||
    data.data?.jobId ||
    data.data?.id;
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
