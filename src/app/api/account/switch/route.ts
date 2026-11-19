import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors";
import { listAccounts } from "@/core/accounts";
import { pickBusiness } from "@/lib/pick-business";

const schema = z.object({ businessId: z.string().uuid() });

// POST /api/account/switch: opens another of the login's businesses on this device. The page then reloads in the
// same tab (a business still setting up opens its onboarding)
export const POST = apiHandler(async (req: NextRequest) => {
  const { businessId } = schema.parse(await req.json());
  const accounts = await listAccounts(await createClient());
  const target = accounts.find((a) => a.id === businessId);
  if (!target) throw new AppError("That business isn't on your list. Reload the page to see your accounts.", "INVALID_INPUT", false);
  return pickBusiness(NextResponse.json({ businessId, status: target.status }), businessId);
});
