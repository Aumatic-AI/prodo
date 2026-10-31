// File storage (Cloudflare R2) end to end: server upload, public link, download, a browser-style
// upload through a signed link, then delete. Leaves nothing behind. Free (a few tiny requests).
// Usage: npm run smoke scripts/smoke/r2.ts
import { publicUrl } from "@/providers/storage/paths";
import { deleteFiles, download, signedUploadUrl, upload } from "@/providers/storage/r2";
import { smoke } from "./_run";

const key = `tmp/smoke/r2-${Date.now()}.txt`;
const signedKey = `tmp/smoke/r2-signed-${Date.now()}.txt`;
const text = `hello from prodo ${new Date().toISOString()}`;

await smoke("r2 upload + public link + download", async () => {
  await upload(key, Buffer.from(text, "utf8"), "text/plain");
  const pub = await fetch(publicUrl(key));
  const viaLink = await pub.text();
  const viaKey = Buffer.from((await download(key))!).toString("utf8");
  if (viaLink !== text || viaKey !== text) throw new Error(`Content differs (public ${pub.status})`);
  return { result: { key, url: publicUrl(key), contentType: pub.headers.get("content-type") } };
});

await smoke("r2 signed upload (as the browser does)", async () => {
  const url = await signedUploadUrl(signedKey, "text/plain");
  const put = await fetch(url, { method: "PUT", body: text, headers: { "Content-Type": "text/plain" } });
  if (!put.ok) throw new Error(`PUT ${put.status}: ${await put.text()}`);
  // The link is only good for its own content type
  const wrong = await fetch(url, { method: "PUT", body: text, headers: { "Content-Type": "image/png" } });
  if (wrong.ok) throw new Error("The signed link accepted another content type");
  const back = Buffer.from((await download(signedKey))!).toString("utf8");
  if (back !== text) throw new Error("Signed upload content differs");
  return { result: { stored: true, wrongTypeRefused: wrong.status } };
});

await smoke("r2 delete", async () => {
  await deleteFiles([key, signedKey]);
  const gone = (await download(key)) === null && (await download(signedKey)) === null;
  if (!gone) throw new Error("Files still there after delete");
  return { result: { deleted: 2 } };
});
