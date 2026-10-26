import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { approveVersion } from "@/core/brand/bible";
import { loadBibleOverview } from "@/core/brand/overview";
import { inngest } from "@/jobs/client";

// Approves a draft: it becomes the Bible every agent uses, and onboarding is finished
export const POST = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { db, businessId } = await currentBusiness();
  const approved = await approveVersion(db, id);
  await inngest.send({ name: "brand/approved", id: `bible-${approved.id}`, data: { businessId, bibleId: approved.id, version: approved.version } });
  return NextResponse.json(await loadBibleOverview(db));
});
