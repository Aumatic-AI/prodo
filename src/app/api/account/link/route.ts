import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { linkBusiness } from "@/core/accounts";

const schema = z.object({
  email: z.string().trim().email("Enter the email of that business's login"),
  password: z.string().min(1, "Enter its password"),
});

// POST /api/account/link: adds a business that has its own login, after signing in with it once (only set-up
// businesses can be added)
export const POST = apiHandler(async (req: NextRequest) => {
  const { email, password } = schema.parse(await req.json());
  return NextResponse.json(await linkBusiness(await createClient(), email, password));
});
