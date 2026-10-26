import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { approvePlan } from "@/core/plans/approval";
import { inngest } from "@/jobs/client";

// Approve the plan: every post that passed QA is approved and scheduled by the Publisher
export const POST = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { db, businessId } = await currentBusiness();
  const result = await approvePlan(db, id);
  await inngest.send({ name: "plan/approved", id: `approve-${id}-${Date.now()}`, data: { businessId, planId: id } });
  return NextResponse.json(result);
});
