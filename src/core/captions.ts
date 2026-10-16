import type { SupabaseClient } from "@supabase/supabase-js";

export async function writeCaptions(
  _db: SupabaseClient,
  _params: {
    mediaIdea: string;
    platforms: string[];
    businessProfile: { name: string; about: string };
  }
): Promise<Record<string, string>> {
  // TODO: call OpenAI via the AI registry to generate per-platform captions
  // const prompt = buildCaptionsPrompt(params);
  // const result = await aiProvider.generate({ prompt });
  // return parseCaptions(result, params.platforms);
  return {};
}

export async function improveCaption(
  _db: SupabaseClient,
  _params: {
    caption: string;
    platform: string;
    instruction: string;
    businessProfile: { name: string; about: string };
  }
): Promise<string> {
  // TODO: call OpenAI to refine the caption based on the instruction
  return _params.caption;
}
