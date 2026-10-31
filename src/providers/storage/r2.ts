import { AwsClient } from "aws4fetch";
import { env } from "@/config/env";
import { AppError, notConfigured } from "@/core/errors";
import { LIMITS } from "@/config/limits";
import { request, statusError } from "@/providers/http";

// Cloudflare R2: the file store. It speaks Amazon S3's API, so every request is signed with the
// R2 key (aws4fetch). Server only: the browser never sees the key, it gets one signed link per upload.

const SERVICE = "File storage";
/** How long a signed upload link works */
const UPLOAD_LINK_SECONDS = 15 * 60;
/** DeleteObjects takes at most this many keys per call */
const DELETE_BATCH = 1000;

let client: AwsClient | null = null;

function r2(): { aws: AwsClient; bucketUrl: string } {
  if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) throw notConfigured(SERVICE);
  client ??= new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
  return { aws: client, bucketUrl: `${env.R2_ENDPOINT.replace(/\/$/, "")}/${env.R2_BUCKET}` };
}

const objectUrl = (bucketUrl: string, key: string) => `${bucketUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;

/** Saves a file (replacing one with the same key). */
export async function upload(key: string, file: Blob | Buffer | ArrayBuffer | Uint8Array, contentType: string): Promise<void> {
  const { aws, bucketUrl } = r2();
  const body = file instanceof Blob ? await file.arrayBuffer() : file;
  const signed = await aws.sign(objectUrl(bucketUrl, key), { method: "PUT", body: body as BodyInit, headers: { "Content-Type": contentType } });
  const res = await request(SERVICE, signed.url, { method: "PUT", headers: signed.headers, body: body as BodyInit }, LIMITS.downloadTimeoutMs);
  if (!res.ok) throw statusError(SERVICE, res.status, await res.text().catch(() => ""));
}

/** The file's bytes, or null when there is no such file. */
export async function download(key: string): Promise<ArrayBuffer | null> {
  const { aws, bucketUrl } = r2();
  const signed = await aws.sign(objectUrl(bucketUrl, key), { method: "GET" });
  const res = await request(SERVICE, signed.url, { headers: signed.headers }, LIMITS.downloadTimeoutMs);
  if (res.status === 404) return null;
  if (!res.ok) throw statusError(SERVICE, res.status, await res.text().catch(() => ""));
  return res.arrayBuffer();
}

/** Deletes files. Keys that don't exist are fine. */
export async function deleteFiles(keys: string[]): Promise<void> {
  const { aws, bucketUrl } = r2();
  const xmlKey = (k: string) => k.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  for (let i = 0; i < keys.length; i += DELETE_BATCH) {
    const body = `<Delete><Quiet>true</Quiet>${keys
      .slice(i, i + DELETE_BATCH)
      .map((k) => `<Object><Key>${xmlKey(k)}</Key></Object>`)
      .join("")}</Delete>`;
    const signed = await aws.sign(`${bucketUrl}?delete`, { method: "POST", body, headers: { "Content-Type": "application/xml" } });
    const res = await request(SERVICE, signed.url, { method: "POST", headers: signed.headers, body }, LIMITS.fetchTimeoutMs);
    if (!res.ok) throw statusError(SERVICE, res.status, await res.text().catch(() => ""));
  }
}

/**
 * A link the browser uploads one file to with a plain PUT, valid for 15 minutes. Signed for this
 * key and this content type only, so it can't be used for another file.
 */
export async function signedUploadUrl(key: string, contentType: string): Promise<string> {
  const { aws, bucketUrl } = r2();
  const url = new URL(objectUrl(bucketUrl, key));
  url.searchParams.set("X-Amz-Expires", String(UPLOAD_LINK_SECONDS));
  const signed = await aws.sign(url.toString(), { method: "PUT", headers: { "Content-Type": contentType }, aws: { signQuery: true, allHeaders: true } });
  if (!signed.url) throw new AppError("Couldn't prepare the upload. Try again.", "UNKNOWN", true);
  return signed.url;
}
