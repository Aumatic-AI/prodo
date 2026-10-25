import { CalendarPlus } from "lucide-react";
import { cn } from "@/lib/utils";
import { dayNumber, formatDay } from "../lib/dates";
import { EVENT_STYLE } from "../lib/entries";
import type { CalendarEvent, Entry } from "../lib/types";
import { EntryCard } from "./EntryCard";

interface Props {
  days: string[];
  today: string;
  selected: string;
  entries: Map<string, Entry[]>;
  events: Map<string, CalendarEvent[]>;
  onSelect: (day: string) => void;
}

/** Seven columns with bigger, time-ordered cards. Scrolls sideways on small screens. */
export function WeekView({ days, today, selected, entries, events, onSelect }: Props) {
  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="grid min-w-[840px] grid-cols-7 gap-2">
        {days.map((day) => {
          const list = entries.get(day) ?? [];
          const isToday = day === today;
          const isSelected = day === selected;
          return (
            <div
              key={day}
              className={cn(
                "flex min-h-[420px] flex-col gap-2 rounded-ob-md border p-2 transition-colors",
                isSelected ? "border-ob-primary bg-ob-primary-soft/40" : "border-ob-line bg-ob-bg/60"
              )}
            >
              <button type="button" onClick={() => onSelect(day)} className="flex items-center gap-2 rounded-ob px-1 py-1 text-left outline-none focus-visible:ring-4 focus-visible:ring-ob-focus">
                <span className={cn("grid size-8 place-items-center rounded-full text-sm font-extrabold tabular-nums", isToday ? "bg-ob-primary text-ob-on-primary" : "bg-ob-surface text-ob-ink shadow-ob-xs")}>
                  {dayNumber(day)}
                </span>
                <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ob-muted">{formatDay(day, { weekday: "short" })}</span>
              </button>
              {(events.get(day) ?? []).map((ev) => (
                <span key={ev.id} className={cn("rounded-ob px-2 py-1 text-[11.5px] font-bold", EVENT_STYLE[ev.kind].chip)}>
                  {ev.name}
                </span>
              ))}
              {list.map((entry) => (
                <EntryCard key={`${entry.kind}-${entry.id}`} entry={entry} compact />
              ))}
              {!list.length && (
                <span className="mt-6 flex flex-col items-center gap-1 text-center text-[12px] text-ob-faint">
                  <CalendarPlus size={16} />
                  Nothing planned
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
