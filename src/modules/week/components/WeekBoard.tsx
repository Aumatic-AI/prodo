import type { PlanItemView } from "@/core/plans/types";
import { weekDays } from "@/lib/zoned-time";
import { cn } from "@/lib/utils";
import { dayLabel, slotDay } from "../lib/time";
import { SlotCard } from "./SlotCard";
import { SlotRow } from "./SlotRow";

interface BoardProps {
  weekStart: string;
  items: PlanItemView[];
  today: string;
  timezone: string;
  onOpen: (id: string) => void;
}

function DayHeader({ day, today }: { day: string; today: string }) {
  const label = dayLabel(day);
  const isToday = day === today;
  return (
    <div className="flex items-baseline justify-between gap-2 px-1.5 pt-1">
      <span className={cn("text-[12px] font-bold uppercase tracking-[0.06em]", isToday ? "text-ob-primary" : "text-ob-muted")}>{label.weekday}</span>
      <span className={cn("truncate text-[13px] font-bold tabular-nums", isToday ? "text-ob-primary" : "text-ob-ink")}>{isToday ? "Today" : label.date}</span>
    </div>
  );
}

/**
 * The week. From md up: seven day columns (days with posts get more room than rest days); when
 * they don't fit, the board scrolls sideways inside its own box and snaps to days. On phones: a
 * day-by-day list, with rest days folded into one line.
 */
export function WeekBoard({ weekStart, items, today, timezone, onOpen }: BoardProps) {
  const days = weekDays(weekStart).map((day) => ({ day, slots: items.filter((i) => slotDay(i.slot_at, timezone) === day) }));
  const columns = days.map((d) => (d.slots.length ? "minmax(176px,1fr)" : "minmax(112px,0.6fr)")).join(" ");
  const restDays = days.filter((d) => !d.slots.length);

  return (
    <>
      {/* Tablet and up: columns */}
      <div className="-mx-1 -mt-1 hidden snap-x snap-mandatory overflow-x-auto scroll-px-1 px-1 pb-2 pt-1 md:block">
        <div className="grid gap-3" style={{ gridTemplateColumns: columns }}>
          {days.map(({ day, slots }) => (
            <div
              key={day}
              className={cn(
                "flex min-w-0 snap-start flex-col gap-3 rounded-ob-lg p-2",
                day === today ? "bg-ob-primary-soft/60 ring-1 ring-ob-primary/25" : "bg-ob-sunken/60",
                day < today && "opacity-75"
              )}
            >
              <DayHeader day={day} today={today} />
              {slots.length ? (
                slots.map((item) => <SlotCard key={item.id} item={item} timezone={timezone} onOpen={() => onOpen(item.id)} />)
              ) : (
                <div className="grid min-h-28 place-items-center rounded-ob-md border border-dashed border-ob-line-strong/60 px-2 text-center text-[12px] text-ob-faint">Rest day</div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Phones: one list, day by day */}
      <div className="flex flex-col gap-4 md:hidden">
        {days
          .filter((d) => d.slots.length)
          .map(({ day, slots }) => (
            <section key={day} className={cn("flex flex-col gap-2", day < today && "opacity-75")}>
              <DayHeader day={day} today={today} />
              {slots.map((item) => (
                <SlotRow key={item.id} item={item} timezone={timezone} onOpen={() => onOpen(item.id)} />
              ))}
            </section>
          ))}
        {restDays.length > 0 && (
          <p className="m-0 rounded-ob-md border border-dashed border-ob-line-strong/60 px-3 py-2.5 text-center text-[12.5px] text-ob-faint">
            Rest days: {restDays.map((d) => dayLabel(d.day).weekday).join(", ")}
          </p>
        )}
      </div>
    </>
  );
}
