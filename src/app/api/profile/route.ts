import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { getProfile } from "@/core/profile";

// The business profile row (read only; Create content reads the voice, language and logo).
// Edits go through Settings → Business profile (PUT /api/settings/profile).
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json(await getProfile(db));
});
