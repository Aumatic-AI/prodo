import type { BusinessProfile } from "@/core/profile";
import { buildProfileBlock } from "./profile-block";
import { PLATFORMS } from "@/config/platforms";

export function buildCaptionsPrompt(
  idea: string,
  platforms: string[],
  profile: BusinessProfile | null
): string {
  const profileContext = buildProfileBlock(profile);
  const platformRules = platforms
    .map((p) => {
      const cfg = PLATFORMS[p];
      return cfg ? `- ${cfg.label}: max ${cfg.captionMaxLength} characters` : `- ${p}`;
    })
    .join("\n");

  return [
    "Write social media captions for the following content.",
    "",
    profileContext ? `Business context:\n${profileContext}` : "",
    "",
    `Content idea: ${idea}`,
    "",
    `Platforms and their limits:\n${platformRules}`,
    "",
    "Requirements:",
    "- Each caption should be tailored to the platform's style and audience",
    "- Include relevant hashtags where appropriate",
    "- Use emojis sparingly and naturally",
    "- Write in English",
    "",
    "Output as JSON: { \"platform_name\": \"caption text\" }",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildImproveCaptionPrompt(
  caption: string,
  platform: string,
  instruction: string
): string {
  const cfg = PLATFORMS[platform];
  return [
    `Improve this ${cfg?.label || platform} caption based on the instruction below.`,
    "",
    `Current caption:\n${caption}`,
    "",
    `Instruction: ${instruction}`,
    "",
    cfg ? `Max ${cfg.captionMaxLength} characters.` : "",
    "",
    "Output only the improved caption, nothing else.",
  ]
    .filter(Boolean)
    .join("\n");
}
