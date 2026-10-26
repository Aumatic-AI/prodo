import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { submitOnboarding } from "@/core/onboarding/submit";
import { unfinishedAgents } from "@/core/onboarding/research";
import { inngest } from "@/jobs/client";

// Locks the answers and starts brand research
export const POST = apiHandler(async () => {
  const { db, businessId } = await currentBusiness();
  const { research } = await submitOnboarding(db);
  // Sent again on a repeat submit in case the first send was lost; the event id makes it run once
  if (research.state === "running") {
    await inngest.send({
      name: "onboarding/started",
      id: research.attempt,
      data: { businessId, runId: research.id, attempt: research.attempt, agents: unfinishedAgents(research) },
    });
  }
  return NextResponse.json({ runId: research.id, status: "analyzing" });
});
