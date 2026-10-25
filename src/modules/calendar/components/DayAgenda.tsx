import { CalendarHeart, Plus, Trash2 } from "lucide-react";
import { Card } from "@/components/kit/Card";
import { button } from "@/components/kit/styles";
import { cn } from "@/lib/utils";
import { formatDay } from "../lib/dates";
import { EVENT_STYLE } from "../lib/entries";
import type { CalendarEvent, Entry } from "../lib/types";
import { EntryCard } from "./EntryCard";

interface Props {
  day: string;
  today: string;
  entries: Entry[];
  events: CalendarEvent[];
  onAddDate: () => void;
  onDeleteEvent: (ev: CalendarEvent) => void;
  deletingId: string | null;
}

/** Everything on the selected day: dates, posts and planned slots. */
export function DayAgenda({ day, today, entries, events, onAddDate, onDeleteEvent, deletingId }: Props) {
  const label = day === today ? "Today" : formatDay(day, { weekday: "long" });
  return (
    <Card
      title={label}
      description={formatDay(day, { day: "numeric", month: "long", year: "numeric" })}
      actions={
        <button type="button" className={button({ variant: "secondary", size: "xs" })} onClick={onAddDate}>
          <Plus size={14} /> Add a date
        </button>
      }
      bodyClassName="flex flex-col gap-2.5"
    >
      {events.map((ev) => (
        <div key={ev.id} className={cn("flex items-start gap-2.5 rounded-ob-md px-3 py-2.5", EVENT_STYLE[ev.kind].chip)}>
          <span className={cn("mt-1 h-4 w-1 shrink-0 rounded-full", EVENT_STYLE[ev.kind].bar)} />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="text-[13.5px] font-bold">{ev.name}</span>
            <span className="text-xs font-medium opacity-80">
              {EVENT_STYLE[ev.kind].label}
              {ev.source === "client" ? " · added by you" : " · found by Prodo"}
              {ev.notes ? ` · ${ev.notes}` : ""}
            </span>
          </span>
          {ev.source === "client" && (
            <button
              type="button"
              className={button({ variant: "danger", size: "iconSm" })}
              aria-label={`Remove ${ev.name}`}
              disabled={deletingId === ev.id}
              onClick={() => onDeleteEvent(ev)}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ))}
      {entries.map((entry) => (
        <EntryCard key={`${entry.kind}-${entry.id}`} entry={entry} />
      ))}
      {!entries.length && !events.length && (
        <div className="flex flex-col items-center gap-1.5 rounded-ob-md border border-dashed border-ob-line-strong px-4 py-7 text-center">
          <CalendarHeart size={20} className="text-ob-faint" />
          <span className="text-sm font-semibold text-ob-ink">A quiet day</span>
          <span className="text-[13px] text-ob-muted">Nothing is planned or scheduled. Add a sale, launch or holiday and the Planner will work around it.</span>
        </div>
      )}
    </Card>
  );
}
