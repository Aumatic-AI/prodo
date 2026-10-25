// Number formatting for the Insights screens. Compact from 1,000 up; rates as percentages.

const compact = new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 });

export function num(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return Math.abs(n) >= 1000 ? compact.format(n) : n.toLocaleString("en", { maximumFractionDigits: 1 });
}

export function pct(rate: number | null | undefined, digits = 1): string {
  if (rate === null || rate === undefined) return "—";
  return `${(rate * 100).toFixed(digits)}%`;
}

export function usd(n: number | null | undefined, digits = 2): string {
  if (n === null || n === undefined) return "—";
  return `$${n.toFixed(n !== 0 && Math.abs(n) < 0.1 ? 3 : digits)}`;
}

/** Change between two values as a fraction (+0.25 = 25% up); null when there's nothing to compare. */
export function change(now: number | null | undefined, before: number | null | undefined): number | null {
  if (now === null || now === undefined || !before) return null;
  return (now - before) / before;
}

export function shortDate(day: string): string {
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${day}T12:00:00Z`));
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
}

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 15));
  return d.toISOString().slice(0, 7);
}

export function duration(ms: number | null | undefined): string {
  if (!ms) return "";
  if (ms < 1000) return `${ms} ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} s`;
  return `${Math.round(ms / 60_000)} min`;
}
