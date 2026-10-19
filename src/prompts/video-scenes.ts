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

  return `You are a professional commercial video director shooting a real, unscripted-feeling social media video — think a skilled creator or small production crew filming on location, not a studio rendering synthetic content.

${profileContext ? `Business details:\n${profileContext}\n` : ""}
Below is a narration script broken into scenes. For each scene, write:
1. A detailed shot description (what the camera sees — composition, lighting, mood, setting), written like a real director's shot list, not a description of generated media
2. A cinematic video motion description (how the scene animates — camera movement, subject action)

Character: ${opts.character || "neutral"} presenter
Style: ${opts.videoType || "Social media"} content — natural, candid, documentary-realistic. Real skin texture and imperfections, authentic ambient lighting, lived-in locations and props. Avoid anything that reads as synthetic, overly smooth, airbrushed, or "AI-generated" — the goal is footage someone would believe was shot with a real camera.

Script:
${numbered}

Requirements:
- Shot descriptions should be detailed and concrete (specific setting, lighting, framing) — describe it the way a director briefs a cinematographer, not the way you'd prompt an image generator
- Video scenarios should describe natural, subtle motion — slow camera moves, gentle animation, the small imperfections of a handheld or tripod shot rather than a perfectly smooth synthetic glide
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
