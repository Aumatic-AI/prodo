"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Calendar as CalendarIcon, Clock, ChevronLeft, ChevronRight } from "lucide-react";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function formatValue(date: Date) {
  const datePart = date.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  const timePart = date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  return `${datePart} · ${timePart}`;
}

function toTimeInputValue(date: Date) {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function isSameDay(a: Date, b: Date) {
  return a.toDateString() === b.toDateString();
}

interface DateTimePickerProps {
  value?: Date;
  onChange: (date: Date | undefined) => void;
  minDate?: Date;
  placeholder?: string;
  className?: string;
}

export function DateTimePicker({
  value,
  onChange,
  minDate,
  placeholder = "Pick a date & time",
  className,
}: DateTimePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => value || new Date());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const todayStr = new Date().toDateString();
  const minDay = minDate ? new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate()) : null;

  function selectDay(day: Date) {
    const next = new Date(day);
    if (value) next.setHours(value.getHours(), value.getMinutes(), 0, 0);
    else next.setHours(9, 0, 0, 0);
    onChange(next);
  }

  function handleTimeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const [hours, minutes] = e.target.value.split(":").map(Number);
    const base = value ? new Date(value) : new Date();
    base.setHours(hours || 0, minutes || 0, 0, 0);
    onChange(base);
  }

  return (
    <div className={cn("relative", className)} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex items-center gap-2 w-full h-10 px-3 rounded-lg border text-sm text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
          open ? "border-primary" : "border-default hover:border-strong"
        )}
        style={{ backgroundColor: "var(--color-page)" }}
      >
        <CalendarIcon className="w-4 h-4 text-secondary shrink-0" />
        <span className={value ? "text-text" : "text-secondary"}>
          {value ? formatValue(value) : placeholder}
        </span>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1.5 left-0 rounded-xl border border-default bg-surface shadow-lg overflow-hidden w-[280px]">
          {/* Month nav */}
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border-subtle)]">
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month - 1, 1))}
              className="p-1 text-muted hover:text-text transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-medium text-text">
              {viewDate.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
            </span>
            <button
              type="button"
              onClick={() => setViewDate(new Date(year, month + 1, 1))}
              className="p-1 text-muted hover:text-text transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 px-3 pt-2.5">
            {DAYS.map((d) => (
              <div key={d} className="text-[10px] font-medium text-secondary uppercase text-center">
                {d[0]}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-y-0.5 px-3 pb-3 pt-1">
            {days.map((day, i) => {
              if (!day) return <div key={`empty-${i}`} />;
              const disabled = minDay ? day < minDay : false;
              const selected = value ? isSameDay(day, value) : false;
              const isToday = day.toDateString() === todayStr;
              return (
                <div key={day.toDateString()} className="flex items-center justify-center">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => selectDay(day)}
                    className={cn(
                      "h-8 w-8 rounded-full text-sm transition-colors",
                      selected
                        ? "bg-primary text-on-primary font-semibold"
                        : isToday
                        ? "text-primary font-semibold"
                        : "text-text hover:bg-surface-hover",
                      disabled && "opacity-30 pointer-events-none"
                    )}
                  >
                    {day.getDate()}
                  </button>
                </div>
              );
            })}
          </div>

          {/* Time */}
          <div
            className="border-t border-[var(--color-border-subtle)] px-3 py-3 flex items-center gap-2.5"
            style={{ backgroundColor: "var(--color-page)" }}
          >
            <label className="flex items-center gap-1.5 text-xs font-medium text-muted uppercase tracking-wide shrink-0">
              <Clock className="w-3.5 h-3.5" />
              Time
            </label>
            <input
              type="time"
              value={value ? toTimeInputValue(value) : ""}
              onChange={handleTimeChange}
              disabled={!value}
              className="flex-1 h-8 px-2 rounded-md border border-default bg-surface text-text text-sm disabled:opacity-50"
            />
          </div>
        </div>
      )}
    </div>
  );
}
