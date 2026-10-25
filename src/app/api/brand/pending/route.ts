import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { PENDING_KINDS, decidePending, listPending } from "@/core/brand/pending";

// Facts found on the website, waiting for the client
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json(await listPending(db));
});

const bodySchema = z.object({
  items: z.array(z.object({ kind: z.enum(PENDING_KINDS), id: z.string().uuid() })).min(1).max(200),
  accept: z.boolean(),
});

// Confirm or reject one or more of them
export const POST = apiHandler(async (req: NextRequest) => {
  const { items, accept } = bodySchema.parse(await req.json());
  const db = await createClient();
  for (const item of items) await decidePending(db, item.kind, item.id, accept);
  return NextResponse.json(await listPending(db));
});
