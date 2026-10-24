import type { BusinessProfile } from "@/core/profile";
import { ai } from "@/providers/ai/registry";
import { parseJson } from "@/lib/json";
import {
  buildCaptionMetadataPrompt,
  buildImproveCaptionPrompt,
  formatPlatformCaptions,
  type CaptionMetadata,
} from "@/prompts/captions";

export async function writeCaptions(params: {
  idea: string;
  imageUrl?: string | null;
  platforms: string[];
  profile: BusinessProfile | null;
}): Promise<Record<string, string>> {
  const { system, user } = buildCaptionMetadataPrompt(params.idea, params.profile);

  let response = params.imageUrl ? await ai.vision(user, params.imageUrl, system) : await ai.text(user, system);

  let meta: CaptionMetadata;
  try {
    meta = parseJson<CaptionMetadata>(response.data);
  } catch {
    // Vision sometimes replies without JSON; retry with text only
    response = await ai.text(user, system);
    meta = parseJson<CaptionMetadata>(response.data);
  }

  return formatPlatformCaptions(meta, params.platforms);
}

export async function improveCaption(params: {
  caption: string;
  platform: string;
  instruction?: string;
}): Promise<string> {
  const { system, user } = buildImproveCaptionPrompt(params.caption, params.platform, params.instruction);
  const { data } = await ai.text(user, system);
  return data.trim();
}
