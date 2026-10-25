import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { regenerateItem } from "@/core/plans/approval";
import { getItemView } from "@/core/plans/plans";
import { inngest } from "@/jobs/client";

const schema = z.object({ note: z.string().trim().max(1000).nullish() });

// "Make it again" with an optional note ("make it punchier"): the whole chain runs again for this slot
export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { note } = schema.parse(await req.json().catch(() => ({})));
  const db = await createClient();
  const item = await regenerateItem(db, id, note ?? null);
  await inngest.send({ name: "plan-item/produce", id: `produce-${id}-${Date.now()}`, data: { itemId: id, planId: item.plan_id, note: note ?? null } });
  return NextResponse.json(await getItemView(db, id));
});
