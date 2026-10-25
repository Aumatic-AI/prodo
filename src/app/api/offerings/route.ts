import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { listOfferings } from "@/core/offerings";

// Active offerings (Create Content's product picker). Editing happens in the Brand Hub.
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json(await listOfferings(db));
});
