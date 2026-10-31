// Sets the R2 bucket's rules. Run once per bucket (again after changing them). Free.
// - Auto-delete: in-between files (work/) after 90 days, job and test files (tmp/) after 7 days,
//   unfinished multipart uploads after 7 days (Cloudflare's default rule, kept).
// - CORS: any page may read files (the renderer reads clips and fonts); only the app may upload (PUT).
//   Origins: http://localhost:3000 plus APP_URL, plus any given on the command line.
// Usage: npm run smoke scripts/setup/r2-bucket.ts [https://app.example.com …]
import { AwsClient } from "aws4fetch";
import { env } from "@/config/env";

const RULES = [
  { id: "work-90-days", prefix: "work/", days: 90 },
  { id: "tmp-7-days", prefix: "tmp/", days: 7 },
];

if (!env.R2_ENDPOINT || !env.R2_ACCESS_KEY_ID || !env.R2_SECRET_ACCESS_KEY || !env.R2_BUCKET) throw new Error("Set the R2_* values first");
const aws = new AwsClient({ accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY, service: "s3", region: "auto" });
const bucketUrl = `${env.R2_ENDPOINT.replace(/\/$/, "")}/${env.R2_BUCKET}`;

async function put(query: string, xml: string) {
  // S3 wants a checksum on bucket settings
  const md5 = (await import("node:crypto")).createHash("md5").update(xml).digest("base64");
  const res = await aws.fetch(`${bucketUrl}?${query}`, { method: "PUT", body: xml, headers: { "Content-Type": "application/xml", "Content-MD5": md5 } });
  if (!res.ok) throw new Error(`${query}: ${res.status} ${await res.text()}`);
}

const lifecycle = `<LifecycleConfiguration xmlns="http://s3.amazonaws.com/doc/2006-03-01/">${RULES.map(
  (r) => `<Rule><ID>${r.id}</ID><Status>Enabled</Status><Filter><Prefix>${r.prefix}</Prefix></Filter><Expiration><Days>${r.days}</Days></Expiration></Rule>`
).join("")}<Rule><ID>Default Multipart Abort Rule</ID><Status>Enabled</Status><Filter><Prefix></Prefix></Filter><AbortIncompleteMultipartUpload><DaysAfterInitiation>7</DaysAfterInitiation></AbortIncompleteMultipartUpload></Rule></LifecycleConfiguration>`;
await put("lifecycle", lifecycle);
console.log("Auto-delete:", RULES.map((r) => `${r.prefix} after ${r.days} days`).join(", "));

const origins = [...new Set(["http://localhost:3000", env.APP_URL, ...process.argv.slice(2)].filter((o): o is string => !!o).map((o) => new URL(o).origin))];
// Reading is open to any page (the files are public anyway, and the video worker's renderer reads
// clips, music and fonts from its own local page); uploading only from the app
const cors = `<CORSConfiguration><CORSRule><AllowedOrigin>*</AllowedOrigin><AllowedMethod>GET</AllowedMethod><AllowedMethod>HEAD</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><ExposeHeader>Content-Length</ExposeHeader><ExposeHeader>Content-Range</ExposeHeader><ExposeHeader>Accept-Ranges</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule><CORSRule>${origins.map((o) => `<AllowedOrigin>${o}</AllowedOrigin>`).join("")}<AllowedMethod>PUT</AllowedMethod><AllowedHeader>*</AllowedHeader><ExposeHeader>ETag</ExposeHeader><MaxAgeSeconds>3600</MaxAgeSeconds></CORSRule></CORSConfiguration>`;
await put("cors", cors);
console.log("Reads allowed from any page; uploads from:", origins.join(", "));
