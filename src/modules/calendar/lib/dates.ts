import { addDays, weekStartOf, zonedParts } from "@/lib/zoned-time";

// Calendar maths on "YYYY-MM-DD" days (the client's own days), no Date objects in local time.

export const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function monthOf(day: string): string {
  return day.slice(0, 7);
}

export function firstOfMonth(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

export function shiftMonth(day: string, n: number): string {
  const [y, m] = day.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 10);
}

/** Every day shown in a month grid: Monday before the 1st to Sunday after the last. */
export function monthGrid(day: string): string[] {
  const first = firstOfMonth(day);
  const last = addDays(shiftMonth(day, 1), -1);
  const start = weekStartOf(first);
  const end = addDays(weekStartOf(last), 6);
  const days: string[] = [];
  for (let d = start; d <= end; d = addDays(d, 1)) days.push(d);
  return days;
}

export function weekOf(day: string): string[] {
  const start = weekStartOf(day);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** The browser's today, until the server's clock (client time zone) arrives. */
export function localToday(): string {
  return zonedParts(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone).day;
}

const fmt = (opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en", { ...opts, timeZone: "UTC" });

/** Formats a day string (no time zone shifts). */
export function formatDay(day: string, opts: Intl.DateTimeFormatOptions): string {
  return fmt(opts).format(new Date(`${day}T12:00:00Z`));
}

/** "09:00" → "9:00 AM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(":").map(Number);
  return fmt({ hour: "numeric", minute: "2-digit" }).format(new Date(Date.UTC(2000, 0, 1, h, m)));
}

export function dayNumber(day: string): number {
  return Number(day.slice(8, 10));
}
