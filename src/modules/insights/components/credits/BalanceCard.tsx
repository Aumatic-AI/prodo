import { CreditIcon } from "@/components/kit/Credits";
import { Alert } from "@/components/kit/Alert";
import type { CreditsView } from "@/core/credits/view";
import { LOW_CREDITS, formatCredits } from "@/config/credits";
import { cn } from "@/lib/utils";

/** The balance, what the month used and added, and a warning when it runs low or a monthly fee waits. */
export function BalanceCard({ data, current }: { data: CreditsView; current: boolean }) {
  const low = data.balance < LOW_CREDITS;
  return (
    <section className="flex flex-col gap-5 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-5">
        <div className="flex items-start gap-3.5">
          <span className={cn("grid size-12 shrink-0 place-items-center rounded-ob-md", low ? "bg-ob-warn-soft text-ob-warn" : "bg-ob-primary-soft text-ob-primary")}>
            <CreditIcon size={24} />
          </span>
          <div className="flex flex-col gap-1">
            <span className="text-[12.5px] font-semibold text-ob-muted">Credits left</span>
            <strong className="text-[36px] font-extrabold leading-none tracking-tight tabular-nums">{formatCredits(data.balance)}</strong>
            <span className="text-[13px] text-ob-muted">The Prodo team adds credits to your account. Ask them when you need more.</span>
          </div>
        </div>
        <div className="flex gap-6">
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="text-[12.5px] font-semibold text-ob-muted">{current ? "Used this month" : "Used that month"}</span>
            <strong className="text-2xl font-extrabold tabular-nums">{formatCredits(data.used)}</strong>
          </div>
          <div className="flex flex-col items-end gap-0.5 text-right">
            <span className="text-[12.5px] font-semibold text-ob-muted">Added</span>
            <strong className="text-2xl font-extrabold tabular-nums">{formatCredits(data.added)}</strong>
          </div>
        </div>
      </div>
      {data.feesDue ? (
        <Alert tone="error">
          Publishing is paused: this month&rsquo;s fee for your {data.feesDue.label.split(" · ")[0]} ({formatCredits(data.feesDue.credits)} credits) is still due. Posts go out again once credits are added.
        </Alert>
      ) : low ? (
        <Alert tone="warn">Your credits are running low. A video uses about 70 and an image ad about 8, so ask the Prodo team to add more before your next plan.</Alert>
      ) : null}
    </section>
  );
}
