import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";

const EVENT_KINDS = ["sale", "launch", "holiday", "trend"] as const;

const schema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date"),
  name: z.string().trim().min(2, "Name the date").max(120, "Keep the name under 120 characters"),
  kind: z.enum(EVENT_KINDS),
  notes: z.string().trim().max(500).nullish(),
  relevance: z.number().int().min(1).max(5).default(4),
});

// A date the Planner should plan around (a sale, launch or holiday), added by the client
export const POST = apiHandler(async (req: NextRequest) => {
  const input = schema.parse(await req.json());
  const db = await createClient();
  const { data, error } = await db
    .from("calendar_events")
    .insert({ date: input.date, name: input.name, kind: input.kind, notes: input.notes || null, relevance: input.relevance, source: "client" })
    .select("id, date, name, kind, relevance, source, notes")
    .single();
  if (error) throw error;
  return NextResponse.json(data, { status: 201 });
});
