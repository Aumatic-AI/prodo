import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { rejectItem } from "@/core/plans/approval";
import { getItemView } from "@/core/plans/plans";
import { inngest } from "@/jobs/client";

const schema = z.object({ note: z.string().trim().max(1000).nullish() });

// Skip this post: it won't be published (the reason helps the agents learn)
export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { note } = schema.parse(await req.json().catch(() => ({})));
  const db = await createClient();
  await rejectItem(db, id, note ?? null);
  await inngest.send({ name: "plan-item/cancelled", data: { itemId: id } });
  return NextResponse.json(await getItemView(db, id));
});
