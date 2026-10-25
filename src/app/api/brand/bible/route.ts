import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { bibleContentSchema, saveDraft } from "@/core/brand/bible";
import { loadBibleOverview } from "@/core/brand/overview";

// The approved Bible, the current draft, version history and whether a draft is being written
export const GET = apiHandler(async () => {
  const db = await createClient();
  return NextResponse.json(await loadBibleOverview(db));
});

// Saving edits always makes a new draft version; the approved one stays until the draft is approved
export const PUT = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const content = bibleContentSchema.parse(await req.json());
  await saveDraft(db, content);
  return NextResponse.json(await loadBibleOverview(db));
});
