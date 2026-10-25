import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { automationSchema, getAutomation, saveAutomation } from "@/core/settings";

// Autopilot mode, weekly plan time, approval timeout, budget, pause and notification email
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json(await getAutomation(db));
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  return NextResponse.json(await saveAutomation(db, automationSchema.parse(await req.json())));
});
