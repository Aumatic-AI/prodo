import { cn } from "@/lib/utils";
import { formatCredits } from "@/config/credits";

// The credit mark: a coin with a four-point spark, drawn like the Lucide icons beside it (24 grid, 2px
// stroke, round joins) so it sits in buttons and lists the same way. Used wherever credits are shown.

export function CreditIcon({ size = 16, className, title }: { size?: number; className?: string; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
      role={title ? "img" : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : true}
    >
      <circle cx="12" cy="12" r="9.5" />
      <path d="M12 6.8c.5 2.9 2.3 4.7 5.2 5.2-2.9.5-4.7 2.3-5.2 5.2-.5-2.9-2.3-4.7-5.2-5.2 2.9-.5 4.7-2.3 5.2-5.2Z" fill="currentColor" strokeWidth={1.2} />
    </svg>
  );
}

/** "✦ 1,240" with the credit mark; `unit` adds the word ("1,240 credits") */
export function CreditAmount({ value, size = 15, unit = false, signed = false, className }: { value: number; size?: number; unit?: boolean; signed?: boolean; className?: string }) {
  const sign = signed && value > 0 ? "+" : "";
  return (
    <span className={cn("inline-flex items-center gap-1.5 tabular-nums", className)}>
      <CreditIcon size={size} className="text-ob-primary" />
      <span>
        {sign}
        {formatCredits(value)}
        {unit && ` credit${Math.abs(value) === 1 ? "" : "s"}`}
      </span>
    </span>
  );
}
