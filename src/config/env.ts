import { z } from "zod";

// Safe to expose to the browser
const publicSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  /** Public address of the file store (Cloudflare R2: the r2.dev address, later our own media domain) */
  NEXT_PUBLIC_MEDIA_URL: z.string().url().optional(),
});

// Server only. Vendor keys are optional so the app boots before every service is set up;
// the adapter that needs a missing key fails with a plain message.
const serverSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1).optional(),
  SUPABASE_PROJECT_REF: z.string().min(1).optional(),
  SUPABASE_ACCESS_TOKEN: z.string().min(1).optional(),
  SUPABASE_DB_PASSWORD: z.string().min(1).optional(),

  TEST_USER_EMAIL: z.string().email().optional(),
  TEST_USER_PASSWORD: z.string().min(1).optional(),

  OPENAI_API_KEY: z.string().min(1).optional(),
  EMBEDDING_MODEL: z.string().min(1).default("text-embedding-3-small"),
  EMBEDDING_DIMENSIONS: z.coerce.number().int().positive().default(1536),
  KIE_API_KEY: z.string().min(1).optional(),
  ELEVENLABS_API_KEY: z.string().min(1).optional(),

  FIRECRAWL_API_KEY: z.string().min(1).optional(),
  TWELVELABS_API_KEY: z.string().min(1).optional(),
  SCRAPECREATORS_API_KEY: z.string().min(1).optional(),

  ZERNIO_API_KEY: z.string().min(1).optional(),
  UPLOAD_POST_API_KEY: z.string().min(1).optional(),
  UPLOAD_POST_PROFILE: z.string().min(1).optional(),

  /** Cloudflare R2 file store (S3 API). The key needs Object Read & Write on the bucket */
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET: z.string().min(1).optional(),
  R2_ENDPOINT: z.string().url().optional(),

  FFMPEG_WORKER_URL: z.string().url().optional(),
  FFMPEG_WORKER_SECRET: z.string().min(1).optional(),
  /** Where videos are put together: "worker" or "upload-post". Unset = the worker when it's configured, else Upload-Post */
  RENDERER: z.enum(["worker", "upload-post"]).optional(),

  /** Email (Resend). Nothing is sent unless EMAIL_ENABLED=1; until then emails are only logged */
  RESEND_API_KEY: z.string().min(1).optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  EMAIL_ENABLED: z.string().optional(),
  /** Public address of the app, for links in emails */
  APP_URL: z.string().url().optional(),

  INNGEST_EVENT_KEY: z.string().min(1).optional(),
  INNGEST_SIGNING_KEY: z.string().min(1).optional(),
  INNGEST_DEV: z.string().optional(),
});

const envSchema = publicSchema.merge(serverSchema);

// Empty strings from a copied .env.example count as "not set"
const raw = Object.fromEntries(
  Object.entries(process.env).filter(([, v]) => v !== "")
);

export const env = envSchema.parse(raw);
export type Env = z.infer<typeof envSchema>;
export type PublicEnv = z.infer<typeof publicSchema>;
