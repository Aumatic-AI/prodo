import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { createClient } from "@/lib/supabase/server";
import { loadOnboarding } from "@/core/onboarding/load";
import { basicsSchema } from "@/core/onboarding/schemas";
import { saveBasics } from "@/core/onboarding/save-basics";
import { startPartialRefresh } from "@/core/onboarding/research";
import { inngest } from "@/jobs/client";

// Business profile in Settings: the same fields, checks and save as onboarding's Basics step
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json((await loadOnboarding(db)).basics);
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const { db, businessId } = await currentBusiness();
  const input = basicsSchema.parse(await req.json());
  const { data: before } = await db.from("business_profile").select("logo_key, onboarding_status").single();
  await saveBasics(db, input);

  // A new logo: the Visual Identity Analyst makes the light and dark versions again (and the colours,
  // unless the client set them by hand)
  if (input.logoKey && input.logoKey !== before?.logo_key && before?.onboarding_status === "done") {
    const research = await startPartialRefresh(db, ["visual_identity_analyst"]);
    if (research) {
      await inngest.send({ name: "onboarding/started", id: research.attempt, data: { businessId, runId: research.id, attempt: research.attempt, agents: ["visual_identity_analyst"] } });
    }
  }
  return NextResponse.json((await loadOnboarding(db)).basics);
});
