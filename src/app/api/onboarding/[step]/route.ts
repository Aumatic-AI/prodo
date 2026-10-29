import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { saveStep } from "@/core/onboarding/save";
import { isStep } from "@/core/onboarding/steps";
import { inngest } from "@/jobs/client";

// Saves one wizard step and returns the fresh draft
export const PUT = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ step: string }> }) => {
  const { step } = await params;
  if (!isStep(step)) {
    return NextResponse.json({ error: { code: "NOT_FOUND", message: "Unknown step" } }, { status: 404 });
  }
  const { db, businessId } = await currentBusiness();
  const body = await req.json().catch(() => ({}));
  const { scan, ...result } = await saveStep(db, step, body);
  // A new website: read it while the client answers the next questions (the scan id makes it run once)
  if (scan) await inngest.send({ name: "onboarding/scan", id: scan.id, data: { businessId, scanId: scan.id } });
  return NextResponse.json(result);
});
