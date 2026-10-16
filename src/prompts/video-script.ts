import type { BusinessProfile } from "@/core/profile";
import { buildProfileBlock } from "./profile-block";

export function sceneCountForDuration(durationSec: number): number {
  return Math.ceil(durationSec / 4);
}

export function buildVideoScriptPrompt(
  idea: string,
  profile: BusinessProfile | null,
  opts: {
    durationSec: number;
    character?: string;
    audioStyle?: string;
    videoType?: string;
    language?: string;
    product?: string;
  }
): string {
  const profileContext = buildProfileBlock(profile);
  const sceneCount = sceneCountForDuration(opts.durationSec);
  const lang = opts.language || "English";

  return `You are a professional social media video scriptwriter.

${profileContext ? `Business context:\n${profileContext}\n` : ""}
Write a narration script for a ${opts.durationSec}-second ${opts.videoType || "social media"} video.

Topic: "${idea}"
${opts.product ? `Product/Service: ${opts.product}` : ""}
Character: ${opts.character || "neutral"} narrator
Tone: ${opts.audioStyle || "Conversational"}
Language: ${lang}

Requirements:
- Write exactly ${sceneCount} narration lines (one per 4-second scene)
- Each line should be speakable in ~4 seconds (roughly 10-15 words)
- Hook the viewer in the first line
- End with a clear call-to-action
- Write in ${lang}

Output as JSON:
{
  "script": ["Line 1", "Line 2", ...]
}

Return ONLY the JSON, no markdown code fences.`;
}
