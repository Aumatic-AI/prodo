// Inputs come from our Supabase storage (or allowed hosts); results go back to it.

import { readFile, writeFile } from "node:fs/promises";
import { ALLOWED_HOSTS, BUCKET, DOWNLOAD_TIMEOUT_MS, SERVICE_KEY, SUPABASE_URL } from "./config.ts";

const KEY_PATTERN = /^[A-Za-z0-9_\-./]+$/;

export function isStorageKey(value: string): boolean {
  return KEY_PATTERN.test(value) && !value.includes("..") && !value.startsWith("/");
}

/** https only, on our Supabase host or an allowed host: nothing else is ever fetched. */
export function isAllowedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === new URL(SUPABASE_URL).hostname) return true;
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

function storageHeaders(): Record<string, string> {
  // New sb_secret_ keys go only in apikey; legacy JWT keys also as Bearer
  return SERVICE_KEY.startsWith("sb_") ? { apikey: SERVICE_KEY } : { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` };
}

export async function download(input: string, path: string): Promise<void> {
  const fromStorage = isStorageKey(input);
  const url = fromStorage ? `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${input}` : input;
  const res = await fetch(url, { headers: fromStorage ? storageHeaders() : {}, signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${fromStorage ? input : new URL(input).hostname}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

export async function uploadResult(path: string, key: string, contentType: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/storage/v1/object/${BUCKET}/${key}`, {
    method: "POST",
    headers: { ...storageHeaders(), "Content-Type": contentType, "x-upsert": "true" },
    body: await readFile(path),
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}
