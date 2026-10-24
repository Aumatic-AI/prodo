import { LIMITS } from "./limits";

const IMAGE_TYPES = ["image/png", "image/jpeg", "image/webp"];

// What each kind of upload accepts. Checked in the browser and again on the server.
export const UPLOAD_RULES = {
  logo: { types: IMAGE_TYPES, maxBytes: LIMITS.logoMaxBytes, folder: "logo", hint: "PNG, JPG or WebP, up to 2 MB" },
  photo: { types: IMAGE_TYPES, maxBytes: LIMITS.imageMaxBytes, folder: "brand/photos", hint: "PNG, JPG or WebP, up to 10 MB each" },
  video: { types: ["video/mp4", "video/quicktime"], maxBytes: LIMITS.videoMaxBytes, folder: "brand/videos", hint: "MP4 or MOV, up to 100 MB each" },
} as const;

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

/** Plain reason a file can't be uploaded, or null when it's fine. */
export function uploadProblem(purpose: UploadPurpose, type: string, size: number): string | null {
  const rule = UPLOAD_RULES[purpose];
  if (!(rule.types as readonly string[]).includes(type)) return `This file type isn't supported. Use ${rule.hint}.`;
  if (size > rule.maxBytes) return `This file is too big. Use ${rule.hint}.`;
  return null;
}
