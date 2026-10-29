import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { loadOnboarding } from "@/core/onboarding/load";

// The whole wizard draft; polled while the website scan runs, so its findings appear in the steps
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json(await loadOnboarding(db));
});
