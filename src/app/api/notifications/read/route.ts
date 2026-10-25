import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { listNotifications, markRead } from "@/core/notifications/notify";

const schema = z.object({ ids: z.union([z.array(z.string().uuid()), z.literal("all")]) });

export const POST = apiHandler(async (req: NextRequest) => {
  const { ids } = schema.parse(await req.json());
  const db = await createClient();
  await markRead(db, ids);
  return NextResponse.json(await listNotifications(db));
});
