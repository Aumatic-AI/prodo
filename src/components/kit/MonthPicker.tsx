"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { button } from "@/components/kit/styles";

// Previous / next month, for screens that show one month at a time (UTC months, "YYYY-MM").

export const thisMonth = () => new Date().toISOString().slice(0, 7);

export function shiftMonth(month: string, by: number): string {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1 + by, 15)).toISOString().slice(0, 7);
}

export function monthLabel(month: string): string {
  return new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${month}-15T12:00:00Z`));
}

export function MonthPicker({ month, onChange }: { month: string; onChange: (month: string) => void }) {
  return (
    <div className="flex items-center rounded-ob-md border border-ob-line bg-ob-surface p-1 shadow-ob-xs">
      <button type="button" aria-label="Previous month" className={button({ variant: "quiet", size: "iconSm" })} onClick={() => onChange(shiftMonth(month, -1))}>
        <ChevronLeft size={16} />
      </button>
      <span className="min-w-[132px] text-center text-[13.5px] font-bold">{monthLabel(month)}</span>
      <button type="button" aria-label="Next month" className={button({ variant: "quiet", size: "iconSm" })} disabled={month >= thisMonth()} onClick={() => onChange(shiftMonth(month, 1))}>
        <ChevronRight size={16} />
      </button>
    </div>
  );
}
