import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { loadProgress } from "@/core/onboarding/progress";

// Live research progress for the progress screen (polled every few seconds while it runs)
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json(await loadProgress(db));
});
