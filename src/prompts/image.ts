import type { BusinessProfile } from "@/core/profile";

export function buildImagePrompt(
  idea: string,
  profile: BusinessProfile | null,
  hasReferenceImage: boolean = false,
  product?: string
): string {
  return `${idea}.${
    profile?.description ? `We are creating an ad for Business ${profile.name}:
    ${profile.description}.` : ""
  } ${
    hasReferenceImage ? " Use the reference image as guidance for the final result." : ""
  }${
    product ? ` This image is specifically about: ${product}.` : ""
  }`;
}

export function withVideoReferenceInstruction(prompt: string): string {
  return `${prompt} The subject shown in the reference image must appear in the generated image exactly as it looks — same appearance and details, consistent throughout.`;
}
