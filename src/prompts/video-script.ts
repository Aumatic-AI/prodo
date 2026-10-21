import type { BusinessProfile } from "@/core/profile";
import { buildProfileBlock } from "./profile-block";

// Real narration pace for a 10-15 word line measures closer to ~5.5s than a
// flat 4s once actually spoken by ElevenLabs — scenes are now sized to their
// own real narration length (not forced to a fixed 4s), so this is what
// determines how many scenes a requested video duration actually needs.
const SECONDS_PER_LINE = 5.5;

export function sceneCountForDuration(durationSec: number): number {
  return Math.ceil(durationSec / SECONDS_PER_LINE);
}

export function buildVideoScriptPrompt(
  idea: string,
  profile: BusinessProfile | null,
  opts: {
    durationSec: number;
    character?: string;
    videoType?: string;
    language?: string;
    product?: string;
  }
): string {
  const profileContext = buildProfileBlock(profile);
  const sceneCount = sceneCountForDuration(opts.durationSec);
  const lang = opts.language || "English";

  return `You are a professional social media video scriptwriter.

${profileContext ? `We are creating videos for the following business:\n${profileContext}\n` : ""}
Write a narration script for a ${opts.durationSec}-second ${opts.videoType || "social media"} video.

Topic: "${idea}"
${opts.product ? `Product/Service: ${opts.product}` : ""}
Character: ${opts.character || "neutral"} narrator
Tone: Conversational
Language: ${lang}

Requirements:
- Write exactly ${sceneCount} narration lines (one per ~5-6 second scene)
- Each line should be speakable in ~5-6 seconds (roughly 10-15 words)
- Hook the viewer in the first line
- End with a clear call-to-action
- Write in ${lang}

Output as JSON:
{
  "script": ["Line 1", "Line 2", ...]
}

Return ONLY the JSON, no markdown code fences.`;
}
