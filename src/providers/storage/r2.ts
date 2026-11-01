import { AwsClient } from "aws4fetch";
import { env } from "@/config/env";
import { AppError, notConfigured } from "@/core/errors";
import { LIMITS } from "@/config/limits";
import { replyError, request, type KnownErrors } from "@/providers/http";

// Cloudflare R2: the file store. It speaks Amazon S3's API, so every request is signed with the
// R2 key (aws4fetch). Server only: the browser never sees the key, it gets one signed link per upload.

const SERVICE = "File storage";
/** How long a signed upload link works */
const UPLOAD_LINK_SECONDS = 15 * 60;
/** DeleteObjects takes at most this many keys per call */
const DELETE_BATCH = 1000;

let client: AwsClient | null = null;

function r2(): { aws: AwsClient; bucketUrl: string } {
  if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) {
    const missing = (["R2_ENDPOINT", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET"] as const).filter((name) => !env[name]);
    throw notConfigured(SERVICE, `${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} empty on the server`);
  }
  client ??= new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
  return { aws: client, bucketUrl: `${env.R2_ENDPOINT.replace(/\/$/, "")}/${env.R2_BUCKET}` };
}

const objectUrl = (bucketUrl: string, key: string) => `${bucketUrl}/${key.split("/").map(encodeURIComponent).join("/")}`;

// R2's error codes (developers.cloudflare.com/r2/api/error-codes), sent as S3 XML: <Error><Code/><Message/></Error>
const KNOWN: KnownErrors = {
  Unauthorized: { say: "it rejected our storage keys", type: "NOT_CONFIGURED", retry: false },
  AccessDenied: { say: "the storage key isn't allowed to do this (check the token's permissions on the bucket)", type: "NOT_CONFIGURED", retry: false },
  InvalidAccessKeyId: { say: "it doesn't know our storage access key", type: "NOT_CONFIGURED", retry: false },
  SignatureDoesNotMatch: { say: "the request's signature didn't match (a wrong secret key, or a file type different from the signed one)", type: "NOT_CONFIGURED", retry: false },
  ExpiredRequest: { say: "the signed link has expired", type: "INVALID_INPUT", retry: false },
  RequestTimeTooSkewed: { say: "our server's clock is too far off", type: "NOT_CONFIGURED", retry: false },
  NoSuchBucket: { say: "the bucket doesn't exist (check R2_BUCKET)", type: "NOT_CONFIGURED", retry: false },
  NoSuchKey: { say: "the file doesn't exist", type: "INVALID_INPUT", retry: false },
  EntityTooLarge: { say: "the file is too big for one upload (5 GB at most)", type: "INVALID_INPUT", retry: false },
  InvalidArgument: { say: "it didn't accept a value we sent", type: "INVALID_INPUT", retry: false },
  MissingContentLength: { say: "the upload had no length", type: "INVALID_INPUT", retry: false },
  IncompleteBody: { say: "the upload arrived incomplete", type: "PROVIDER_DOWN", retry: true },
  ClientDisconnect: { say: "the connection dropped during the transfer", type: "PROVIDER_DOWN", retry: true },
  TooManyRequests: { say: "too many writes to the same file at once", type: "RATE_LIMITED", retry: true },
  SlowDown: { say: "it asked us to slow down", type: "RATE_LIMITED", retry: true },
  InternalError: { say: "it had an internal error", type: "PROVIDER_DOWN", retry: true },
  ServiceUnavailable: { say: "it's overloaded right now", type: "PROVIDER_DOWN", retry: true },
};

async function storageError(res: Response, what: string): Promise<AppError> {
  return replyError(SERVICE, res, undefined, await res.text().catch(() => ""), what, KNOWN);
}

/** Saves a file (replacing one with the same key). */
export async function upload(key: string, file: Blob | Buffer | ArrayBuffer | Uint8Array, contentType: string): Promise<void> {
  const { aws, bucketUrl } = r2();
  const body = file instanceof Blob ? await file.arrayBuffer() : file;
  const signed = await aws.sign(objectUrl(bucketUrl, key), { method: "PUT", body: body as BodyInit, headers: { "Content-Type": contentType } });
  const res = await request(SERVICE, signed.url, { method: "PUT", headers: signed.headers, body: body as BodyInit }, LIMITS.downloadTimeoutMs);
  if (!res.ok) throw await storageError(res, `saving ${key}`);
}

/** The file's bytes, or null when there is no such file. */
export async function download(key: string): Promise<ArrayBuffer | null> {
  const { aws, bucketUrl } = r2();
  const signed = await aws.sign(objectUrl(bucketUrl, key), { method: "GET" });
  const res = await request(SERVICE, signed.url, { headers: signed.headers }, LIMITS.downloadTimeoutMs);
  if (res.status === 404) return null;
  if (!res.ok) throw await storageError(res, `reading ${key}`);
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
    const count = Math.min(DELETE_BATCH, keys.length - i);
    if (!res.ok) throw await storageError(res, `deleting ${count} file${count === 1 ? "" : "s"}`);
    // A 200 still lists each file it couldn't delete: <Error><Key/><Code/><Message/></Error>
    const failed = [...(await res.text().catch(() => "")).matchAll(/<Error>([\s\S]*?)<\/Error>/g)].map(([, e]) => ({
      key: e.match(/<Key>([^<]*)<\/Key>/)?.[1] ?? "?",
      code: e.match(/<Code>([^<]*)<\/Code>/)?.[1] ?? "no code",
      message: e.match(/<Message>([^<]*)<\/Message>/)?.[1] ?? "",
    }));
    if (failed.length) {
      const first = failed[0];
      throw new AppError(`${SERVICE} couldn't delete ${failed.length} of ${count} files; the first, ${first.key}: ${first.message || "no message"} (${first.code}).`, "PROVIDER_DOWN", true);
    }
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
  if (!signed.url) throw new AppError(`Couldn't sign the upload link for ${key}.`, "UNKNOWN", true);
  return signed.url;
}
