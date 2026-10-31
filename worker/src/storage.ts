// Inputs come from our storage, Cloudflare R2 (or allowed hosts); results go back to it.
// R2 speaks Amazon S3's API, so every request is signed with the R2 key (aws4fetch).

import { readFile, writeFile } from "node:fs/promises";
import { AwsClient } from "aws4fetch";
import { ALLOWED_HOSTS, DOWNLOAD_TIMEOUT_MS, R2_ACCESS_KEY_ID, R2_BUCKET, R2_ENDPOINT, R2_PUBLIC_URL, R2_SECRET_ACCESS_KEY } from "./config.ts";

const KEY_PATTERN = /^[A-Za-z0-9_\-./]+$/;
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
const objectUrl = (key: string) => `${R2_ENDPOINT}/${R2_BUCKET}/${key}`;

export function isStorageKey(value: string): boolean {
  return KEY_PATTERN.test(value) && !value.includes("..") && !value.startsWith("/");
}

/** https only, on our storage's public host or an allowed host: nothing else is ever fetched. */
export function isAllowedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    if (host === new URL(R2_PUBLIC_URL).hostname) return true;
    return ALLOWED_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export async function download(input: string, path: string): Promise<void> {
  const fromStorage = isStorageKey(input);
  const signal = AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS);
  const res = fromStorage ? await r2.fetch(objectUrl(input), { signal }) : await fetch(input, { signal });
  if (!res.ok) throw new Error(`Download failed (${res.status}) for ${fromStorage ? input : new URL(input).hostname}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

export async function uploadResult(path: string, key: string, contentType: string): Promise<void> {
  const res = await r2.fetch(objectUrl(key), {
    method: "PUT",
    headers: { "Content-Type": contentType },
    body: await readFile(path),
    signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${(await res.text()).slice(0, 200)}`);
}
