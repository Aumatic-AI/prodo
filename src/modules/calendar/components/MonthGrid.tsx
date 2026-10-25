import { cn } from "@/lib/utils";
import { dayNumber, monthOf, WEEKDAYS } from "../lib/dates";
import { EVENT_STYLE, statusOf, TONE_DOT } from "../lib/entries";
import type { CalendarEvent, Entry } from "../lib/types";
import { EntryChip } from "./EntryChip";

const MAX_CHIPS = 3;

interface Props {
  days: string[];
  month: string;
  today: string;
  selected: string;
  entries: Map<string, Entry[]>;
  events: Map<string, CalendarEvent[]>;
  onSelect: (day: string) => void;
}

/** Month grid: dates as thin banners, posts as chips, planned slots as dashed chips. */
export function MonthGrid({ days, month, today, selected, entries, events, onSelect }: Props) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-7 gap-1.5">
        {WEEKDAYS.map((d) => (
          <span key={d} className="px-0.5 pb-1 text-center text-[11px] font-bold uppercase tracking-[0.08em] text-ob-faint sm:px-2 sm:text-left">
            {/* One letter on phones */}
            <span className="sm:hidden">{d.charAt(0)}</span>
            <span className="max-sm:hidden">{d}</span>
          </span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5">
        {days.map((day) => {
          const list = entries.get(day) ?? [];
          const dayEvents = events.get(day) ?? [];
          const inMonth = monthOf(day) === month;
          const isToday = day === today;
          const isSelected = day === selected;
          const past = day < today;
          return (
            <div
              key={day}
              role="button"
              tabIndex={0}
              aria-pressed={isSelected}
              aria-label={`${day}: ${list.length} posts${dayEvents.length ? `, ${dayEvents.map((e) => e.name).join(", ")}` : ""}`}
              onClick={() => onSelect(day)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onSelect(day))}
              className={cn(
                "group flex min-h-[58px] cursor-pointer flex-col gap-1 overflow-hidden rounded-ob-md border p-1 text-left sm:min-h-[118px] sm:p-1.5 outline-none transition-all duration-150",
                "focus-visible:ring-4 focus-visible:ring-ob-focus",
                inMonth ? "bg-ob-surface" : "bg-ob-bg/60",
                isSelected ? "border-ob-primary shadow-ob-sm ring-1 ring-ob-primary" : "border-ob-line hover:border-ob-line-strong hover:shadow-ob-xs",
                past && !isSelected && "opacity-80"
              )}
            >
              <span className="flex items-center justify-center px-0.5 sm:justify-between">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full text-[12px] font-bold tabular-nums sm:size-7 sm:text-[13px]",
                    isToday ? "bg-ob-primary text-ob-on-primary shadow-ob-sm" : inMonth ? "text-ob-ink" : "text-ob-faint"
                  )}
                >
                  {dayNumber(day)}
                </span>
                {isToday && <span className="text-[10.5px] font-bold uppercase tracking-wide text-ob-primary max-sm:hidden">Today</span>}
              </span>
              {/* Phones: a dot per post and a bar for key dates; tapping the day shows them in full */}
              <span className="flex flex-wrap items-center justify-center gap-0.5 sm:hidden" aria-hidden="true">
                {dayEvents.length > 0 && <span className={cn("h-1 w-3 rounded-full", EVENT_STYLE[dayEvents[0].kind].bar)} />}
                {list.slice(0, 4).map((entry) => (
                  <span key={`${entry.kind}-${entry.id}`} className={cn("size-1.5 rounded-full", TONE_DOT[statusOf(entry).tone])} />
                ))}
              </span>
              {dayEvents.slice(0, 2).map((ev) => (
                <span key={ev.id} className={cn("flex items-center gap-1 truncate max-sm:hidden rounded-[6px] px-1.5 py-0.5 text-[10.5px] font-bold", EVENT_STYLE[ev.kind].chip)} title={ev.name}>
                  <span className={cn("h-2.5 w-0.5 shrink-0 rounded-full", EVENT_STYLE[ev.kind].bar)} />
                  <span className="truncate">{ev.name}</span>
                </span>
              ))}
              <span className="flex flex-col gap-1 max-sm:hidden">
                {list.slice(0, MAX_CHIPS).map((entry) => (
                  <EntryChip key={`${entry.kind}-${entry.id}`} entry={entry} />
                ))}
              </span>
              {list.length > MAX_CHIPS && <span className="px-1 text-[11px] font-bold text-ob-primary max-sm:hidden">+{list.length - MAX_CHIPS} more</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
