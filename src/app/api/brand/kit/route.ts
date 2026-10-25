import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { getKit, kitSchema, saveKit } from "@/core/brand/kit";

export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json(await getKit(db));
});

export const PUT = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  return NextResponse.json(await saveKit(db, kitSchema.parse(await req.json())));
});
