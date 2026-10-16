import type { BusinessProfile } from "@/core/profile";

export function buildImagePrompt(
  idea: string,
  profile: BusinessProfile | null,
  useLogo: boolean
): string {
  const parts: string[] = [];

  parts.push(idea);

  if (profile?.about) {
    parts.push(`Context: ${profile.about}`);
  }

  parts.push("Photorealistic, high quality, professional social media image, vibrant colors, sharp detail");

  if (useLogo && profile?.name) {
    parts.push(`Include ${profile.name} logo naturally in the scene`);
  }

  return parts.join(". ");
}
