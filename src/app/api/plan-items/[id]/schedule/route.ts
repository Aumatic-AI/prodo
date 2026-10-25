import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors";
import { getItem, getItemView } from "@/core/plans/plans";
import { inngest } from "@/jobs/client";

// Schedule an approved post again (e.g. after connecting the missing account)
export const POST = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const db = await createClient();
  const item = await getItem(db, id);
  if (item.status !== "approved") throw new AppError("Only approved posts can be scheduled.", "INVALID_INPUT", false);
  await inngest.send({ name: "plan-item/approved", id: `schedule-${id}-${Math.floor(Date.now() / 60_000)}`, data: { itemId: id } });
  return NextResponse.json(await getItemView(db, id));
});
