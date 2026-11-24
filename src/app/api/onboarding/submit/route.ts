import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { submitOnboarding } from "@/core/onboarding/submit";
import { unfinishedAgents } from "@/core/onboarding/research";
import { inngest } from "@/jobs/client";
import { assertCredits, charged, spendCredits } from "@/core/credits/ledger";
import { priceOf } from "@/core/credits/prices";

const WHAT = "Starting your brand research";
/** Onboarding is charged once per business: a repeat submit or a retry of its research costs nothing more */
const KEY = "onboarding";

// Locks the answers and starts brand research (onboarding's credits)
export const POST = apiHandler(async () => {
  const { db, businessId } = await currentBusiness();
  const paid = await charged(businessId, KEY);
  if (!paid) await assertCredits(businessId, await priceOf("onboarding"), WHAT);
  const { research } = await submitOnboarding(db);
  // Sent again on a repeat submit in case the first send was lost; the event id makes it run once
  if (research.state === "running") {
    if (!paid) await spendCredits(businessId, { action: "onboarding", label: "Onboarding: website scan and brand research", refId: research.id, key: KEY }, WHAT);
    await inngest.send({
      name: "onboarding/started",
      id: research.attempt,
      data: { businessId, runId: research.id, attempt: research.attempt, agents: unfinishedAgents(research) },
    });
  }
  return NextResponse.json({ runId: research.id, status: "analyzing" });
});
