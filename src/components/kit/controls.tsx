"use client";

import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/kit/styles";

interface SliderProps {
  id: string;
  left: string;
  right: string;
  value: number;
  onChange: (value: number) => void;
}

/** 0 = the left word, 100 = the right word. */
export function Slider({ id, left, right, value, onChange }: SliderProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between text-sm font-semibold">
        <span className={cn("transition-colors", value <= 50 ? "text-ob-ink" : "text-ob-muted")}>{left}</span>
        <span className={cn("transition-colors", value >= 50 ? "text-ob-ink" : "text-ob-muted")}>{right}</span>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-label={`${left} to ${right}`}
        aria-valuetext={value < 50 ? `More ${left}` : value > 50 ? `More ${right}` : "Balanced"}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-7 w-full cursor-pointer accent-ob-primary"
      />
    </div>
  );
}

interface CounterProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  unit?: string;
}

const counterButton = cn(
  "grid size-10 place-items-center rounded-ob border border-ob-line bg-ob-surface text-ob-ink transition-colors",
  "enabled:hover:border-ob-primary enabled:hover:bg-ob-primary-soft disabled:cursor-not-allowed disabled:opacity-40",
  focusRing
);

export function Counter({ label, value, onChange, min = 0, max = 21, unit = "/ week" }: CounterProps) {
  return (
    <span className="inline-flex items-center gap-1">
      <button type="button" className={counterButton} aria-label={`Fewer ${label}`} disabled={value <= min} onClick={() => onChange(value - 1)}>
        <Minus size={16} />
      </button>
      <span className="min-w-[76px] text-center font-bold tabular-nums" aria-live="polite">
        {value} {unit}
      </span>
      <button type="button" className={counterButton} aria-label={`More ${label}`} disabled={value >= max} onClick={() => onChange(value + 1)}>
        <Plus size={16} />
      </button>
    </span>
  );
}

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}

export function Switch({ checked, onChange, label }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn("group inline-flex items-center gap-2.5 rounded-full text-sm font-semibold text-ob-ink", focusRing)}
    >
      <span className="relative h-6 w-10 shrink-0 rounded-full bg-ob-line-strong transition-colors group-aria-checked:bg-ob-primary" aria-hidden="true">
        <span className="absolute left-[3px] top-[3px] size-[18px] rounded-full bg-ob-surface shadow-ob-sm transition-transform group-aria-checked:translate-x-4" />
      </span>
      {label}
    </button>
  );
}
