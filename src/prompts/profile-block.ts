import type { BusinessProfile } from "@/core/profile";

export function buildProfileBlock(profile: BusinessProfile | null): string {
  if (!profile) return "";
  const parts: string[] = [];
  if (profile.name) parts.push(`Business Name: ${profile.name}`);
  if (profile.website) parts.push(`Website: ${profile.website}`);
  if (profile.about) parts.push(`About: ${profile.about}`);
  return parts.join("\n");
}
