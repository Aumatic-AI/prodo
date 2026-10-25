import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { inngest } from "@/jobs/client";

// "Update learnings now": runs the Performance Analyst's weekly learning straight away
export const POST = apiHandler(async () => {
  await inngest.send({ name: "performance/learn", id: `learn-${Math.floor(Date.now() / 600_000)}`, data: {} });
  return NextResponse.json({ started: true });
});
