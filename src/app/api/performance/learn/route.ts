import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { inngest } from "@/jobs/client";

// "Update learnings now": runs the Performance Analyst's weekly learning straight away
export const POST = apiHandler(async () => {
  const { businessId } = await currentBusiness();
  await inngest.send({ name: "performance/learn", id: `learn-${businessId}-${Math.floor(Date.now() / 600_000)}`, data: { businessId } });
  return NextResponse.json({ started: true });
});
