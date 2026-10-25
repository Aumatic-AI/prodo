import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { resolveSources } from "@/core/brand/sources";

// "Show sources": the passages and answers behind one claim (?refs=chunk:…,answer:…)
export const GET = apiHandler(async (req: NextRequest) => {
  const refs = (req.nextUrl.searchParams.get("refs") ?? "").split(",").filter(Boolean).slice(0, 12);
  const db = await createClient();
  return NextResponse.json(await resolveSources(db, refs));
});
