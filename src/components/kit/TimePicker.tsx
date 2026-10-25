"use client";

import { useMemo } from "react";
import { Select, type DropdownOption } from "@/components/kit/Select";

interface TimePickerProps {
  id?: string;
  /** "HH:MM", 24-hour */
  value: string;
  onChange: (value: string) => void;
  stepMinutes?: number;
  className?: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

function toLabel(value: string): string {
  const [h, m] = value.split(":").map(Number);
  const suffix = h < 12 ? "AM" : "PM";
  return `${h % 12 || 12}:${pad(m)} ${suffix}`;
}

/** Time of day as a dropdown, in steps (15 minutes by default). */
export function TimePicker({ id, value, onChange, stepMinutes = 15, className }: TimePickerProps) {
  const options = useMemo<DropdownOption[]>(() => {
    const list: DropdownOption[] = [];
    for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
      const v = `${pad(Math.floor(minutes / 60))}:${pad(minutes % 60)}`;
      list.push({ value: v, label: toLabel(v) });
    }
    // Keep a saved time that isn't on the step, e.g. 09:10
    if (value && !list.some((o) => o.value === value)) list.push({ value, label: toLabel(value) });
    return list.sort((a, b) => a.value.localeCompare(b.value));
  }, [stepMinutes, value]);

  return <Select id={id} searchable searchPlaceholder="Type a time, e.g. 9:30" options={options} value={value || null} onValueChange={onChange} placeholder="Pick a time" className={className} />;
}
