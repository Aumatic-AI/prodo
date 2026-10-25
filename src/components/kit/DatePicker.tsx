"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { DayPicker } from "react-day-picker";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { button, floating, trigger } from "@/components/kit/styles";

interface DatePickerProps {
  id?: string;
  /** "YYYY-MM-DD", or "" when empty */
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  /** Earliest pickable day, "YYYY-MM-DD" */
  min?: string;
  className?: string;
  "aria-label"?: string;
}

// Dates are stored as plain "YYYY-MM-DD" and handled in local time, so no timezone shift
function toDate(value: string): Date | undefined {
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

function toValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

const label = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" });

/** Calendar date picker (the shadcn pattern: popover + react-day-picker), styled with ob tokens. */
export function DatePicker({ id, value, onChange, placeholder = "Pick a date", min, className, ...rest }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = toDate(value);
  const minDate = min ? toDate(min) : undefined;

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger id={id} aria-label={rest["aria-label"]} className={cn(trigger, className)}>
        <span className={cn("min-w-0 truncate", !selected && "text-ob-faint")}>{selected ? label.format(selected) : placeholder}</span>
        <CalendarDays size={16} className="shrink-0 text-ob-muted" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner sideOffset={6} align="start" className="z-50 outline-none">
          <Popover.Popup className={cn(floating, "p-3")}>
            <DayPicker
              mode="single"
              selected={selected}
              defaultMonth={selected ?? minDate}
              onSelect={(date) => {
                if (!date) return;
                onChange(toValue(date));
                setOpen(false);
              }}
              disabled={minDate ? { before: minDate } : undefined}
              weekStartsOn={1}
              showOutsideDays
              components={{
                Chevron: ({ orientation }) => (orientation === "left" ? <ChevronLeft size={16} /> : <ChevronRight size={16} />),
              }}
              classNames={{
                root: "w-fit",
                months: "relative flex flex-col",
                month: "flex flex-col gap-3",
                nav: "absolute inset-x-0 top-0 flex items-center justify-between",
                button_previous: button({ variant: "ghost", size: "icon" }),
                button_next: button({ variant: "ghost", size: "icon" }),
                month_caption: "flex h-9 items-center justify-center",
                caption_label: "text-sm font-bold",
                month_grid: "border-collapse",
                weekdays: "flex",
                weekday: "w-9 text-center text-xs font-medium text-ob-muted",
                week: "mt-1 flex",
                day: "size-9 p-0 text-center text-sm",
                day_button:
                  "grid size-9 cursor-pointer place-items-center rounded-ob font-medium outline-none transition-colors hover:bg-ob-primary-soft focus-visible:ring-4 focus-visible:ring-ob-focus",
                selected: "[&>button]:bg-ob-primary [&>button]:text-ob-on-primary [&>button]:hover:bg-ob-primary-hover",
                today: "[&>button]:underline [&>button]:decoration-2 [&>button]:underline-offset-4",
                outside: "text-ob-faint",
                disabled: "opacity-35 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
                hidden: "invisible",
              }}
            />
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
