"use client";

import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/kit/styles";

export interface Option<T extends string = string> {
  value: T;
  label: string;
  description?: string;
  icon?: ReactNode;
}

interface PillsProps<T extends string> {
  options: readonly Option<T>[];
  /** One value for single choice, a list for multi choice */
  value: T | T[] | null;
  onChange: (value: T) => void;
  label?: string;
}

/** Toggle chips. The parent decides single or multi choice in onChange. */
export function Pills<T extends string>({ options, value, onChange, label }: PillsProps<T>) {
  const isOn = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={isOn(o.value)}
          onClick={() => onChange(o.value)}
          className={cn(
            "inline-flex min-h-10 items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-semibold transition-colors duration-150",
            focusRing,
            isOn(o.value)
              ? "border-ob-primary bg-ob-primary-soft text-ob-primary"
              : "border-ob-line-strong bg-ob-surface text-ob-ink hover:border-ob-primary"
          )}
        >
          {o.icon}
          {o.label}
        </button>
      ))}
    </div>
  );
}

interface ChoiceCardsProps<T extends string> {
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label?: string;
}

/** Single choice shown as cards with a title and a short description. */
export function ChoiceCards<T extends string>({ options, value, onChange, label }: ChoiceCardsProps<T>) {
  return (
    <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,200px),1fr))] gap-3" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = value === o.value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "flex items-start gap-3 rounded-ob-md border p-4 text-left transition-[border-color,background-color,box-shadow] duration-150",
              focusRing,
              on
                ? "border-ob-primary bg-ob-primary-soft shadow-[inset_0_0_0_1px_var(--color-ob-primary)]"
                : "border-ob-line-strong bg-ob-surface hover:border-ob-primary hover:shadow-ob-sm"
            )}
          >
            <span
              className={cn(
                "grid size-[22px] shrink-0 place-items-center rounded-full border-2 text-ob-on-primary transition-colors",
                on ? "border-ob-primary bg-ob-primary" : "border-ob-line-strong"
              )}
              aria-hidden="true"
            >
              {on && <Check size={13} strokeWidth={3} />}
            </span>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-[15px] font-bold text-ob-ink">{o.label}</span>
              {o.description && <span className="text-[13px] text-ob-muted">{o.description}</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/** Adds or removes a value from a list. For multi-choice Pills. */
export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
