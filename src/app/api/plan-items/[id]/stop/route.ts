import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { stopItem } from "@/core/plans/approval";
import { getItemView } from "@/core/plans/plans";
import { inngest } from "@/jobs/client";

// Stop a post the agents are still making: its run is cancelled first, then the post is marked stopped
export const POST = apiHandler(async (_req: Request, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { db, businessId } = await currentBusiness();
  const item = await stopItem(db, id, () => inngest.send({ name: "plan-item/cancelled", data: { businessId, itemId: id } }));
  // A plan waiting for its posts counts this one as settled
  await inngest.send({ name: "plan-item/settled", data: { businessId, itemId: id, planId: item.plan_id } });
  return NextResponse.json(await getItemView(db, id));
});
