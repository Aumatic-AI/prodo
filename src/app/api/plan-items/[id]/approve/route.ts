import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { approveItem } from "@/core/plans/approval";
import { getItemView } from "@/core/plans/plans";
import { inngest } from "@/jobs/client";

// Approve one post: the Publisher schedules it at its slot time
export const POST = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const db = await createClient();
  await approveItem(db, id);
  await inngest.send({ name: "plan-item/approved", id: `approve-item-${id}-${Math.floor(Date.now() / 60_000)}`, data: { itemId: id } });
  return NextResponse.json(await getItemView(db, id));
});
