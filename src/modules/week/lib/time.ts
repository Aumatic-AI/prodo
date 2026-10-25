import { zonedParts } from "@/lib/zoned-time";

// Slot times in the client's own time zone (not the browser's).

export function slotDay(iso: string, tz: string): string {
  return zonedParts(new Date(iso), tz).day;
}

export function slotTime(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function slotWhen(iso: string, tz: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: tz, weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
}

export function dayLabel(day: string): { weekday: string; date: string } {
  const d = new Date(`${day}T12:00:00Z`);
  return {
    weekday: new Intl.DateTimeFormat("en-GB", { weekday: "short", timeZone: "UTC" }).format(d),
    date: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(d),
  };
}

export function weekRange(weekStart: string): string {
  const start = new Date(`${weekStart}T12:00:00Z`);
  const end = new Date(start.getTime() + 6 * 86400_000);
  const f = (d: Date, withMonth: boolean) => new Intl.DateTimeFormat("en-GB", { day: "numeric", ...(withMonth ? { month: "short" } : {}), timeZone: "UTC" }).format(d);
  return start.getUTCMonth() === end.getUTCMonth() ? `${f(start, false)}–${f(end, true)}` : `${f(start, true)} – ${f(end, true)}`;
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 45) return "just now";
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function timeUntil(iso: string): string {
  const s = Math.round((new Date(iso).getTime() - Date.now()) / 1000);
  if (s <= 0) return "now";
  if (s < 3600) return `${Math.max(1, Math.round(s / 60))} min`;
  if (s < 86400) return `${Math.round(s / 3600)} h`;
  return `${Math.round(s / 86400)} days`;
}
