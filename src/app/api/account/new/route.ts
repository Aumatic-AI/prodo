import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { createBusiness } from "@/core/accounts";
import { pickBusiness } from "@/lib/pick-business";

// POST /api/account/new: "Add account" → a new business (or the unfinished one, to finish first). It opens on
// this device and the page goes to its onboarding; it's a full account once its Brand Bible is approved
export const POST = apiHandler(async () => {
  const businessId = await createBusiness(await createClient());
  return pickBusiness(NextResponse.json({ businessId }), businessId);
});
