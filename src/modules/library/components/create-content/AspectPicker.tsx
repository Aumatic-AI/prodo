"use client";

import { cn } from "@/lib/utils";
import { focusRing } from "@/components/kit/styles";
import { RATIOS, type Ratio } from "./options";

/** Size as little shapes, so the choice is visual. */
export function AspectPicker({ value, onChange, allowed }: { value: Ratio; onChange: (v: Ratio) => void; allowed?: Ratio[] }) {
  const ratios = allowed ? RATIOS.filter((r) => allowed.includes(r.value)) : RATIOS;
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4" role="radiogroup" aria-label="Size">
      {ratios.map((r) => {
        const on = r.value === value;
        return (
          <button
            key={r.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(r.value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-ob-md border px-3 py-3.5 transition-[border-color,background-color,box-shadow] duration-150",
              focusRing,
              on ? "border-ob-primary bg-ob-primary-soft shadow-[inset_0_0_0_1px_var(--color-ob-primary)]" : "border-ob-line-strong bg-ob-surface hover:border-ob-primary"
            )}
          >
            <span className="grid h-10 place-items-center">
              <span className={cn("rounded-[5px] border-2 transition-colors", r.box, on ? "border-ob-primary bg-ob-primary/15" : "border-ob-muted")} />
            </span>
            <span className="flex flex-col items-center leading-tight">
              <span className="text-sm font-bold text-ob-ink">
                {r.label} <span className="font-semibold text-ob-muted">{r.value}</span>
              </span>
              <span className="text-xs text-ob-muted">{r.use}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
