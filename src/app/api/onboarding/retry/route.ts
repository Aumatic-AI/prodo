import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { loadProgress } from "@/core/onboarding/progress";
import { retryResearch } from "@/core/onboarding/research";
import { inngest } from "@/jobs/client";

// Runs the research agents that didn't finish again. Only after a failure or when the run is stuck.
export const POST = apiHandler(async () => {
  const { db, businessId } = await currentBusiness();
  const { lastActivityAt } = await loadProgress(db);
  const { research, agents, started } = await retryResearch(db, lastActivityAt);
  if (started) {
    await inngest.send({ name: "onboarding/started", id: research.attempt, data: { businessId, runId: research.id, attempt: research.attempt, agents } });
  }
  return NextResponse.json(await loadProgress(db));
});
