import { ArrowDownRight, ArrowUpRight, Minus, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** One headline number with its change vs. the previous period. Up is good unless `invert`. */
export function StatTile({
  label,
  value,
  delta,
  icon: Icon,
  hint,
  invert = false,
}: {
  label: string;
  value: string;
  /** Fractional change (+0.12 = 12% up); null hides the badge */
  delta?: number | null;
  icon?: LucideIcon;
  hint?: string;
  invert?: boolean;
}) {
  const flat = delta !== null && delta !== undefined && Math.abs(delta) < 0.005;
  const good = delta !== null && delta !== undefined && (invert ? delta < 0 : delta > 0);
  const Arrow = flat ? Minus : delta && delta > 0 ? ArrowUpRight : ArrowDownRight;
  return (
    <div className="flex min-w-0 flex-col gap-2 rounded-ob-lg border border-ob-line bg-ob-surface p-4 shadow-ob-xs transition-shadow duration-200 hover:shadow-ob-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[12.5px] font-semibold text-ob-muted">{label}</span>
        {Icon && <Icon size={15} className="shrink-0 text-ob-faint" aria-hidden="true" />}
      </div>
      <strong className="truncate text-[26px] font-extrabold leading-none tracking-tight tabular-nums text-ob-ink">{value}</strong>
      <div className="flex min-h-5 items-center gap-1.5 text-[12px]">
        {delta !== null && delta !== undefined ? (
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 font-bold tabular-nums",
              flat ? "bg-ob-sunken text-ob-muted" : good ? "bg-ob-success-soft text-ob-success" : "bg-ob-danger-soft text-ob-danger"
            )}
          >
            <Arrow size={12} aria-hidden="true" />
            {Math.abs(delta * 100).toFixed(0)}%
          </span>
        ) : null}
        {hint && <span className="truncate text-ob-faint">{hint}</span>}
      </div>
    </div>
  );
}
