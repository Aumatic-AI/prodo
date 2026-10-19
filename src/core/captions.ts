import type { BusinessProfile } from "@/core/profile";
import * as OpenAI from "@/providers/ai/openai";
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

  let response = params.imageUrl
    ? await OpenAI.generateTextWithImage(user, params.imageUrl, system)
    : await OpenAI.generateText(user, system);

  let meta: CaptionMetadata;
  try {
    meta = OpenAI.parseJsonResponse(response) as CaptionMetadata;
  } catch {
    // The vision call occasionally hedges/refuses instead of returning JSON —
    // fall back to a text-only call (idea only, no image) rather than hard-failing.
    response = await OpenAI.generateText(user, system);
    meta = OpenAI.parseJsonResponse(response) as CaptionMetadata;
  }

  return formatPlatformCaptions(meta, params.platforms);
}

export async function improveCaption(params: {
  caption: string;
  platform: string;
  instruction?: string;
}): Promise<string> {
  const { system, user } = buildImproveCaptionPrompt(params.caption, params.platform, params.instruction);
  const response = await OpenAI.generateText(user, system);
  return response.trim();
}
