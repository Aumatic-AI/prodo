// Dates in the client's time zone, without a date library. Days are "YYYY-MM-DD", times "HH:MM".

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(tz: string): Intl.DateTimeFormat {
  let f = formatters.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formatters.set(tz, f);
  }
  return f;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** A valid IANA zone, or UTC. */
export function safeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    formatter(tz);
    return tz;
  } catch {
    return "UTC";
  }
}

/** Wall-clock day, time and weekday (0 = Sunday) of an instant in `tz`. */
export function zonedParts(date: Date, tz: string): { day: string; time: string; weekday: number; hour: number; minute: number } {
  const parts = Object.fromEntries(formatter(tz).formatToParts(date).map((p) => [p.type, p.value]));
  return {
    day: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: WEEKDAYS.indexOf(parts.weekday),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/** Minutes `tz` is ahead of UTC at that instant (e.g. 330 for Asia/Kolkata). */
function offsetMinutes(date: Date, tz: string): number {
  const p = Object.fromEntries(formatter(tz).formatToParts(date).map((x) => [x.type, x.value]));
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60000);
}

/** The instant a wall-clock day and time in `tz` happens (handles daylight saving). */
export function zonedToUtc(day: string, time: string, tz: string): Date {
  const [y, m, d] = day.split("-").map(Number);
  const [h, min] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, h, min);
  const first = offsetMinutes(new Date(guess), tz);
  const utc = guess - first * 60000;
  const second = offsetMinutes(new Date(utc), tz);
  return new Date(second === first ? utc : guess - second * 60000);
}

export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

/** 0 = Sunday … 6 = Saturday */
export function weekdayOf(day: string): number {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Monday on or before the day: the start of its plan week. */
export function weekStartOf(day: string): string {
  return addDays(day, -((weekdayOf(day) + 6) % 7));
}

/** The Monday after the day (never the day itself): the week a plan made today covers. */
export function nextWeekStart(day: string): string {
  return addDays(weekStartOf(day), 7);
}

/** The seven days of the week that starts on `weekStart`. */
export function weekDays(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}
