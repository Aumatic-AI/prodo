import type { BrandFolder } from "@/providers/storage/paths";
import { LIMITS } from "./limits";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];
const VIDEO_TYPES = ["video/mp4", "video/quicktime"];

const MEDIA_HINT = "Images (PNG, JPG, WebP) or videos (MP4, MOV), up to 100 MB each";

interface UploadRule {
  types: readonly string[];
  maxBytes: number;
  /** Brand folder the file goes in; null = photos or videos by its type */
  folder: BrandFolder | null;
  hint: string;
}

// What each kind of upload accepts. Checked in the browser and again on the server.
export const UPLOAD_RULES = {
  logo: { types: IMAGE_TYPES, maxBytes: LIMITS.logoMaxBytes, folder: "logo", hint: "PNG, JPG or WebP, up to 2 MB" },
  photo: { types: IMAGE_TYPES, maxBytes: LIMITS.imageMaxBytes, folder: "photos", hint: "PNG, JPG or WebP, up to 10 MB each" },
  video: { types: VIDEO_TYPES, maxBytes: LIMITS.videoMaxBytes, folder: "videos", hint: "MP4 or MOV, up to 100 MB each" },
  // Photos and videos in one list (e.g. the client's own shots)
  media: { types: [...IMAGE_TYPES, ...VIDEO_TYPES], maxBytes: LIMITS.videoMaxBytes, folder: null, hint: MEDIA_HINT },
  // Posts and ads the client likes
  reference: { types: [...IMAGE_TYPES, ...VIDEO_TYPES], maxBytes: LIMITS.videoMaxBytes, folder: "references", hint: MEDIA_HINT },
} satisfies Record<string, UploadRule>;

export type UploadPurpose = keyof typeof UPLOAD_RULES;

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "video/mp4": "mp4",
  "video/quicktime": "mov",
};

export function extensionFor(type: string): string {
  return EXTENSIONS[type] ?? "bin";
}

/** The brand folder an upload goes in */
export function uploadFolder(purpose: UploadPurpose, type: string): BrandFolder {
  const rule: UploadRule = UPLOAD_RULES[purpose];
  return rule.folder ?? (VIDEO_TYPES.includes(type) ? "videos" : "photos");
}

/** Plain reason a file can't be uploaded, or null when it's fine. */
export function uploadProblem(purpose: UploadPurpose, type: string, size: number): string | null {
  const rule: UploadRule = UPLOAD_RULES[purpose];
  if (!rule.types.includes(type)) return `This file type isn't supported. Use ${rule.hint}.`;
  // Images stay under the image limit even where videos are allowed
  const max = IMAGE_TYPES.includes(type) ? Math.min(rule.maxBytes, LIMITS.imageMaxBytes) : rule.maxBytes;
  if (size > max) return `This file is too big. Use ${rule.hint}.`;
  return null;
}
