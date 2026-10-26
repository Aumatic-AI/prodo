import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { publisherFor } from "@/providers/publishing/registry";

// The business's own connected accounts (its Zernio profile)
export const GET = apiHandler(async () => {
  const accounts = await publisherFor().listAccounts(await createClient());
  return NextResponse.json(accounts);
});
