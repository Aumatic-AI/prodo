import { request } from "@/providers/http";

// Public holidays per country from Nager.Date (free, no key): https://date.nager.at
// The Planner times posts around them like any other key date.

const SERVICE = "Public holidays";

export interface Holiday {
  date: string;
  name: string;
  countryCode: string;
}

export async function publicHolidays(countryCode: string, year: number): Promise<Holiday[]> {
  const res = await request(SERVICE, `https://date.nager.at/api/v3/PublicHolidays/${year}/${encodeURIComponent(countryCode.toUpperCase())}`, {}, 20_000);
  // 404: country not covered; 204: no data
  if (res.status === 404 || res.status === 204) return [];
  if (!res.ok) return [];
  const body = (await res.json().catch(() => [])) as { date: string; localName?: string; name: string; global?: boolean }[];
  return body.filter((h) => h.global !== false).map((h) => ({ date: h.date, name: h.localName && h.localName !== h.name ? `${h.name} (${h.localName})` : h.name, countryCode: countryCode.toUpperCase() }));
}
