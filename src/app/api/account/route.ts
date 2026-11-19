import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { listAccounts } from "@/core/accounts";

// GET /api/account: the login's businesses for the account menu (the same on every device)
export const GET = apiHandler(async () => NextResponse.json(await listAccounts(await createClient())));
