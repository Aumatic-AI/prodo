import type { BusinessProfile } from "@/core/profile";
import { buildProfileBlock } from "./profile-block";

export function buildScenesPrompt(
  scriptLines: string[],
  profile: BusinessProfile | null,
  opts: {
    character?: string;
    videoType?: string;
  }
): string {
  const profileContext = buildProfileBlock(profile);
  const numbered = scriptLines.map((line, i) => `Scene ${i + 1}: "${line}"`).join("\n");

  return `You are a professional video scene director for AI-generated content.

${profileContext ? `Business context:\n${profileContext}\n` : ""}
Below is a narration script broken into scenes. For each scene, write:
1. A detailed image generation prompt (what the viewer sees — composition, lighting, mood, setting)
2. A cinematic video motion description (how the scene animates — camera movement, subject action)

Character: ${opts.character || "neutral"} presenter
Style: ${opts.videoType || "Social media"} content, photorealistic, cinematic quality

Script:
${numbered}

Requirements:
- Image prompts should be detailed enough for AI image generation (Flux-style)
- Video scenarios should describe natural, subtle motion — slow camera moves, gentle animation
- Keep visual continuity across scenes (consistent setting, character, color grade)
- Each scene lasts roughly 5-6 seconds — describe motion paced to read naturally over that span, not a quick action that finishes in a flash

Output as JSON:
{
  "visual_prompts": [
    { "scene": 1, "prompt": "Detailed image prompt...", "video_scenario": "Camera slowly pushes in..." },
    ...
  ]
}

Return ONLY the JSON, no markdown code fences.`;
}
