import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";

const PAGE = 60;

// What the agents did (agent_runs), newest first: the activity feed.
// Filters: planId, itemId, agent, status (failed); paging with before=<created_at of the last row>.
export const GET = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const q = req.nextUrl.searchParams;
  let query = db
    .from("agent_runs")
    .select("id, agent, status, summary, error, cost_usd, duration_ms, run_id, plan_id, plan_item_id, media_id, created_at")
    .order("created_at", { ascending: false })
    .limit(q.get("itemId") ? 100 : PAGE);
  if (q.get("planId")) query = query.eq("plan_id", q.get("planId")!);
  if (q.get("itemId")) query = query.eq("plan_item_id", q.get("itemId")!);
  if (q.get("agent")) query = query.eq("agent", q.get("agent")!);
  if (q.get("status")) query = query.eq("status", q.get("status")!);
  if (q.get("before")) query = query.lt("created_at", q.get("before")!);
  const { data, error } = await query;
  if (error) throw error;
  return NextResponse.json(data ?? []);
});
