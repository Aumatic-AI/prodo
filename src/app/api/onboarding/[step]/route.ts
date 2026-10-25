import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { saveStep } from "@/core/onboarding/save";
import { isStep } from "@/core/onboarding/steps";

// Saves one wizard step and returns the fresh draft
export const PUT = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ step: string }> }) => {
  const { step } = await params;
  if (!isStep(step)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown step" } }, { status: 404 });
  }
  const db = await createClient();
  const body = await req.json().catch(() => ({}));
  return NextResponse.json(await saveStep(db, step, body));
});
