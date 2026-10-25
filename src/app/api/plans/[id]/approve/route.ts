import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { approvePlan } from "@/core/plans/approval";
import { inngest } from "@/jobs/client";

// Approve the plan: every post that passed QA is approved and scheduled by the Publisher
export const POST = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const db = await createClient();
  const result = await approvePlan(db, id);
  await inngest.send({ name: "plan/approved", id: `approve-${id}-${Date.now()}`, data: { planId: id } });
  return NextResponse.json(result);
});
