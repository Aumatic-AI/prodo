import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { loadProgress } from "@/core/onboarding/progress";
import { RESEARCH_AGENTS, startRefresh } from "@/core/onboarding/research";
import { inngest } from "@/jobs/client";

// "Refresh brand": runs the whole research again and writes a new Bible draft
export const POST = apiHandler(async () => {
  const { db, businessId } = await currentBusiness();
  const { lastActivityAt } = await loadProgress(db);
  const research = await startRefresh(db, lastActivityAt);
  await inngest.send({ name: "onboarding/started", id: research.attempt, data: { businessId, runId: research.id, attempt: research.attempt, agents: [...RESEARCH_AGENTS] } });
  return NextResponse.json(await loadProgress(db));
});
