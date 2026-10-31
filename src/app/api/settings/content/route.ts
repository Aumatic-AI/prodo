import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { contentSettingsSchema } from "@/core/onboarding/schemas";
import { getContentSettings, saveContentSettings } from "@/core/content/settings";

// Settings → Content: formats, styles, people, voice, music, logo and where customers go
export const GET = apiHandler(async () => NextResponse.json(await getContentSettings(await createClient())));

export const PUT = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const input = contentSettingsSchema.parse(await req.json());
  return NextResponse.json(await saveContentSettings(db, input));
});
