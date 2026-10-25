import { NextResponse, type NextRequest } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/core/errors";
import { listItemsBetween } from "@/core/plans/plans";
import { weekClock } from "@/core/plans/week";
import { addDays, zonedToUtc } from "@/lib/zoned-time";

const DAY = /^\d{4}-\d{2}-\d{2}$/;

// GET /api/calendar?from=YYYY-MM-DD&to=YYYY-MM-DD (client's days, `to` included):
// posts, planned slots not yet scheduled, and calendar dates in that range
export const GET = apiHandler(async (req: NextRequest) => {
  const db = await createClient();
  const clock = await weekClock(db);
  const from = req.nextUrl.searchParams.get("from") ?? clock.thisWeek;
  const to = req.nextUrl.searchParams.get("to") ?? addDays(from, 41);
  if (!DAY.test(from) || !DAY.test(to) || to < from) throw new AppError("Pick a valid date range.", "INVALID_INPUT", false);

  const start = zonedToUtc(from, "00:00", clock.timezone).toISOString();
  const end = zonedToUtc(addDays(to, 1), "00:00", clock.timezone).toISOString();

  const [scheduled, unscheduled, items, events] = await Promise.all([
    db.from("posts").select("*, post_targets(*), media(type, storage_key, idea, content)").gte("publish_at", start).lt("publish_at", end),
    // Posts published straight away have no publish time
    db.from("posts").select("*, post_targets(*), media(type, storage_key, idea, content)").is("publish_at", null).gte("created_at", start).lt("created_at", end),
    listItemsBetween(db, start, end),
    db.from("calendar_events").select("id, date, name, kind, relevance, source, notes").gte("date", from).lte("date", to).order("date"),
  ]);
  for (const r of [scheduled, unscheduled, events]) if (r.error) throw r.error;

  return NextResponse.json({
    clock,
    from,
    to,
    posts: [...(scheduled.data ?? []), ...(unscheduled.data ?? [])],
    // Slots that became posts show as posts
    items: items.filter((i) => !i.post),
    events: events.data ?? [],
  });
});
