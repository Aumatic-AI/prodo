import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { loadOnboarding } from "@/core/onboarding/load";
import { basicsSchema } from "@/core/onboarding/schemas";
import { saveBasics } from "@/core/onboarding/save-basics";

// Business profile in Settings: the same fields, checks and save as onboarding's Basics step
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json((await loadOnboarding(db)).basics);
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  await saveBasics(db, basicsSchema.parse(await req.json()));
  return NextResponse.json((await loadOnboarding(db)).basics);
});
