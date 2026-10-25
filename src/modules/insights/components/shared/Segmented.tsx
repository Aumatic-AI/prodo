import { cn } from "@/lib/utils";

/** A small row of mutually exclusive choices (ranges, metrics). */
export function Segmented<T extends string | number>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex items-center rounded-ob-md border border-ob-line bg-ob-surface p-1 shadow-ob-xs">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "rounded-ob px-3 py-1.5 text-[13px] font-semibold transition-colors",
            value === o.value ? "bg-ob-primary-soft text-ob-primary" : "text-ob-muted hover:text-ob-ink"
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
