import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Signs out a login that isn't linked to a business (the app layouts send it here) and explains why
// on the login page. Route handlers can clear the session cookies; layouts can't. A login that has
// a business is never signed out here, so a link from another site can't log anyone out.
export async function GET(req: NextRequest) {
  const db = await createClient();
  const { data } = await db.from("businesses").select("id").maybeSingle();
  if (data) return NextResponse.redirect(new URL("/week", req.nextUrl.origin));

  await db.auth.signOut();
  const url = new URL("/login", req.nextUrl.origin);
  url.searchParams.set("error", "no_business");
  return NextResponse.redirect(url);
}
