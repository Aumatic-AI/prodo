import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { createClient } from "@/lib/supabase/server";
import { automationSchema, getAutomation, saveAutomation } from "@/core/settings";
import { inngest } from "@/jobs/client";

// Autopilot mode, weekly plan time, approval timeout, budget, pause and notification email
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json(await getAutomation(db));
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const { db, businessId } = await currentBusiness();
  const input = automationSchema.parse(await req.json());
  const { data: before } = await db.from("app_settings").select("paused").single();
  const saved = await saveAutomation(db, input);
  // Pausing also holds posts already scheduled with the provider; resuming schedules them again
  if (before && before.paused !== input.paused) {
    await inngest.send({ name: "settings/paused-changed", data: { businessId, paused: input.paused } });
  }
  return NextResponse.json(saved);
});
