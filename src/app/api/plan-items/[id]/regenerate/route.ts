import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { currentBusiness } from "@/core/business";
import { restartItem } from "@/core/plans/approval";
import { getItem, getItemView } from "@/core/plans/plans";
import { assertVideoReady } from "@/providers/ffmpeg/client";

const schema = z.object({ note: z.string().trim().max(1000).nullish() });

// "Make it again" with an optional note ("make it punchier"): the whole chain runs again for this slot
export const POST = apiHandler(async (req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const { note } = schema.parse(await req.json().catch(() => ({})));
  const { db, businessId } = await currentBusiness();
  const item = await getItem(db, id);
  // Videos need our renderer; say so now instead of after the reset
  if (item.format === "video") await assertVideoReady();
  await restartItem(db, businessId, id, note ?? null);
  return NextResponse.json(await getItemView(db, id));
});
