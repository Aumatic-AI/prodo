import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { removeAccount } from "@/core/accounts";
import { PICKED_BUSINESS_COOKIE } from "@/lib/active-business";
import { pickBusiness } from "@/lib/pick-business";

const schema = z.object({ businessId: z.string().uuid() });

// POST /api/account/remove: takes a business off the login's list (unlinks a linked one; deletes one this login
// made while it's still setting up). When it was open on this device, the login's own business opens instead
export const POST = apiHandler(async (req: NextRequest) => {
  const { businessId } = schema.parse(await req.json());
  const result = await removeAccount(await createClient(), businessId);
  const wasOpen = req.cookies.get(PICKED_BUSINESS_COOKIE)?.value === businessId;
  const res = NextResponse.json({ result, reload: wasOpen });
  return wasOpen ? pickBusiness(res, null) : res;
});
