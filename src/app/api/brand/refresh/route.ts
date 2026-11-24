import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { loadProgress } from "@/core/onboarding/progress";
import { RESEARCH_AGENTS, startRefresh } from "@/core/onboarding/research";
import { inngest } from "@/jobs/client";
import { assertCredits, spendCredits } from "@/core/credits/ledger";
import { priceOf } from "@/core/credits/prices";

// "Refresh brand": runs the whole research again and writes a new Bible draft (its credits; a retry of a
// failed run is free)
export const POST = apiHandler(async () => {
  const { db, businessId } = await currentBusiness();
  const { lastActivityAt } = await loadProgress(db);
  await assertCredits(businessId, await priceOf("brand_refresh"), "Refreshing your brand");
  const research = await startRefresh(db, lastActivityAt);
  await spendCredits(businessId, { action: "brand_refresh", label: "Refresh brand", refId: research.id, key: `research:${research.attempt}` }, "Refreshing your brand");
  await inngest.send({ name: "onboarding/started", id: research.attempt, data: { businessId, runId: research.id, attempt: research.attempt, agents: [...RESEARCH_AGENTS] } });
  return NextResponse.json(await loadProgress(db));
});
