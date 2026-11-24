import { ArrowDownLeft, ArrowUpRight, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Card } from "@/components/kit/Card";
import type { CreditRow } from "@/core/credits/view";
import { formatCredits } from "@/config/credits";
import { cn } from "@/lib/utils";

const KIND = {
  topup: { icon: ArrowDownLeft, tone: "bg-ob-success-soft text-ob-success", name: "Added" },
  adjust: { icon: SlidersHorizontal, tone: "bg-ob-sunken text-ob-muted", name: "Corrected" },
  charge: { icon: ArrowUpRight, tone: "bg-ob-primary-soft text-ob-primary", name: "Used" },
  refund: { icon: RotateCcw, tone: "bg-ob-warn-soft text-ob-warn", name: "Returned" },
} as const;

const when = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Every change in the month, newest first: what it was for, the credits, and the balance after. */
export function CreditHistory({ rows, showAmounts = false, title = "History", description }: { rows: CreditRow[]; showAmounts?: boolean; title?: string; description?: string }) {
  return (
    <Card title={title} description={description ?? "Everything that used or added credits this month. Failed work gives its credits back."}>
      {rows.length ? (
        <ul className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
          {rows.map((r) => {
            const k = KIND[r.kind];
            const Icon = k.icon;
            return (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <span className={cn("grid size-9 shrink-0 place-items-center rounded-full", k.tone)} aria-hidden="true">
                  <Icon size={16} />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-[13.5px] font-semibold text-ob-ink">{r.label || k.name}</span>
                  <span className="truncate text-[12px] text-ob-muted">
                    {when.format(new Date(r.created_at))}
                    {showAmounts && r.amount_usd !== null && ` · paid $${r.amount_usd.toFixed(2)}`}
                    {showAmounts && r.note && ` · ${r.note}`}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-end">
                  <strong className={cn("text-[14px] tabular-nums", r.credits > 0 ? "text-ob-success" : "text-ob-ink")}>
                    {r.credits > 0 ? "+" : "−"}
                    {formatCredits(Math.abs(r.credits))}
                  </strong>
                  <span className="text-[11.5px] tabular-nums text-ob-faint">{formatCredits(r.balance)} left</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="m-0 text-sm text-ob-muted">Nothing used or added this month.</p>
      )}
    </Card>
  );
}
