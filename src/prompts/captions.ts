import type { BusinessProfile } from "@/core/profile";
import { buildProfileBlock } from "./profile-block";

export interface CaptionMetadata {
  title: string;
  post: string;
  tags: string;
  caption: string;
}

export function buildCaptionMetadataPrompt(
  idea: string,
  profile: BusinessProfile | null
): { system: string; user: string } {
  const profileContext = buildProfileBlock(profile);

  const system = `You are a social media content strategist${profile?.name ? ` for ${profile.name}` : ""}.

${profileContext ? `Business context:\n${profileContext}\n` : ""}
Your task is to analyze the content idea below (and the attached image, if one is provided) and generate optimized social media metadata.

TITLE RULES
- Maximum 60 characters
- Use 1-2 emojis
- Create curiosity, emotion, or inspiration

POST RULES
- Length between 150 and 200 characters
- Compress the situation, the value, and the outcome into one concise story
- Emotional and human, never jargon-heavy
- No pricing, no invented statistics

CAPTION RULES
- 150 to 300 characters
- Strong emotional opening
- One key insight
- 3-4 short benefit points using emojis
- End with an engagement question
- Warm, human, social-media-native tone

TAGS RULES
- 8-12 hashtags
- Searchable CamelCase hashtags, no spaces
- Relevant to the business and the idea

QUALITY RULES
- Professional but human-sounding, never robotic
- No exaggerated claims, no invented pricing or percentages
- Never fabricate specifics not present in the business context or idea above

OUTPUT FORMAT
Return ONLY valid JSON. No markdown, no backticks, no commentary.
{
  "title": "Generated title (max 60 chars, 1-2 emojis)",
  "post": "Generated post (150-200 chars)",
  "tags": "#Tag1 #Tag2 #Tag3 ...",
  "caption": "Generated caption (150-300 chars, ends with an engagement question)"
}`;

  const user = `IDEA: ${idea}\n\nGenerate the metadata as instructed. Return ONLY the JSON object.`;

  return { system, user };
}

function truncateWithTags(caption: string, tags: string[], limit: number): string {
  let text = caption.length > limit ? caption.slice(0, limit - 1).trimEnd() + "…" : caption;
  for (const tag of tags) {
    const next = `${text} ${tag}`;
    if (next.length > limit) break;
    text = next;
  }
  return text;
}

export function formatPlatformCaptions(meta: CaptionMetadata, platforms: string[]): Record<string, string> {
  const tagList = meta.tags.split(/\s+/).filter(Boolean);
  const result: Record<string, string> = {};

  for (const platform of platforms) {
    switch (platform) {
      case "facebook":
        result[platform] = `${meta.post}\n\n${tagList.slice(0, 5).join(" ")}`;
        break;
      case "instagram":
        result[platform] = `${meta.caption}\n.\n.\n.\n${tagList.join(" ")}`;
        break;
      case "linkedin":
        result[platform] = `${meta.post}\n\n${tagList.slice(0, 7).join(" ")}`;
        break;
      case "tiktok":
        result[platform] = truncateWithTags(meta.caption, tagList, 85);
        break;
      case "twitter":
        result[platform] = truncateWithTags(meta.caption, tagList, 150);
        break;
      default:
        result[platform] = meta.caption;
    }
  }

  return result;
}

const PLATFORM_TONE: Record<string, string> = {
  facebook: "warm and conversational, can run a bit longer",
  instagram: "visual-first, casual, hashtag-friendly",
  linkedin: "professional but still human, no corporate jargon",
  tiktok: "short, punchy, hooks fast, under 85 characters",
  twitter: "punchy and concise, under 150 characters",
};

export function buildImproveCaptionPrompt(
  caption: string,
  platform: string,
  instruction?: string
): { system: string; user: string } {
  const system = `You are a social media copy editor.

YOUR JOB
Rewrite the given ${platform} caption to be more engaging, ${
    instruction ? `following this specific instruction: "${instruction}"` : "improving clarity, hook strength, and tone"
  } — while keeping the same core message and any facts present.

STYLE FOR THIS PLATFORM: ${PLATFORM_TONE[platform] || "clear and engaging"}

HARD RULES
- Never invent facts, numbers, or claims not already implied by the original caption.
- Keep whatever hashtags were present, unless the instruction says otherwise.
- No markdown, no commentary, no quotes around the output.
- Output ONLY the rewritten caption text, nothing else.`;

  const user = `ORIGINAL CAPTION:\n${caption}\n\nRewrite it as instructed. Output only the new caption text.`;

  return { system, user };
}
