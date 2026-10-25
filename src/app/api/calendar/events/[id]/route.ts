import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors";

// Removes a date the client added. Dates the research found stay (they can't be deleted here).
export const DELETE = apiHandler(async (_req: NextRequest, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const db = await createClient();
  const { data: event, error } = await db.from("calendar_events").select("id, source").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!event) throw new AppError("This date doesn't exist any more.", "INVALID_INPUT", false);
  if (event.source !== "client") throw new AppError("Only dates you added yourself can be removed.", "INVALID_INPUT", false);
  const { error: delError } = await db.from("calendar_events").delete().eq("id", id);
  if (delError) throw delError;
  return NextResponse.json({ ok: true });
});
