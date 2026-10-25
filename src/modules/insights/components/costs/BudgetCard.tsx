import Link from "next/link";
import { Wallet } from "lucide-react";
import type { CostsView } from "@/core/performance/costs";
import { cn } from "@/lib/utils";
import { usd } from "../../lib/format";

/** The month's spend against the budget, and what a finished asset costs on average. */
export function BudgetCard({ data, current }: { data: CostsView; current: boolean }) {
  const used = data.budget ? Math.min(100, (data.total / data.budget) * 100) : 0;
  const tone = used >= 90 ? "bg-ob-danger" : used >= 70 ? "bg-ob-warn" : "bg-ob-primary";
  return (
    <section className="flex flex-col gap-5 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-ob-md bg-ob-primary-soft text-ob-primary">
            <Wallet size={20} />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ob-muted">Spent by the agents</span>
            <strong className="text-[34px] font-extrabold leading-none tracking-tight tabular-nums">{usd(data.total)}</strong>
            <span className="text-[13px] text-ob-muted">
              of a {usd(data.budget, 0)} monthly budget ·{" "}
              <Link href="/settings?tab=automation" className="font-semibold text-ob-primary hover:underline">
                change
              </Link>
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-0.5 text-right">
          <span className="text-[12.5px] font-semibold text-ob-muted">Per finished image, carousel or video</span>
          <strong className="text-2xl font-extrabold tabular-nums">{data.perAsset !== null ? usd(data.perAsset) : "—"}</strong>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <div className="h-2.5 overflow-hidden rounded-full bg-ob-sunken">
          <div className={cn("h-full rounded-full transition-[width] duration-700", tone)} style={{ width: `${Math.max(1, used)}%` }} />
        </div>
        <div className="flex justify-between text-[12px] text-ob-muted">
          <span>{Math.round(used)}% used</span>
          <span>{current ? `${usd(Math.max(0, data.budget - data.total))} left this month` : "Month closed"}</span>
        </div>
      </div>
    </section>
  );
}
