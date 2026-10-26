import type { SupabaseClient } from "@supabase/supabase-js";
import { AppError } from "@/core/errors";
import { nextWeekStart, safeZone, weekStartOf, zonedParts } from "@/lib/zoned-time";

// Which plan week a screen or request means, in the client's own time zone.

export interface WeekClock {
  timezone: string;
  /** Today in the client's time zone */
  today: string;
  thisWeek: string;
  nextWeek: string;
}

export async function weekClock(db: SupabaseClient): Promise<WeekClock> {
  const { data } = await db.from("business_profile").select("timezone").single();
  const timezone = safeZone(data?.timezone);
  const today = zonedParts(new Date(), timezone).day;
  return { timezone, today, thisWeek: weekStartOf(today), nextWeek: nextWeekStart(today) };
}

/** "this", "next" or any day ("YYYY-MM-DD") → the Monday of that week. */
export function resolveWeek(value: string | null, clock: WeekClock): string {
  if (!value || value === "this") return clock.thisWeek;
  if (value === "next") return clock.nextWeek;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new AppError("Pick a week like 2026-11-02.", "INVALID_INPUT", false);
  return weekStartOf(value);
}
