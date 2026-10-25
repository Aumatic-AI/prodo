"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Coins } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { Card } from "@/components/kit/Card";
import { EmptyState } from "@/components/kit/EmptyState";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { addDays } from "@/lib/zoned-time";
import { AGENT_NAMES } from "@/modules/week/lib/status";
import { useCosts } from "../hooks/useInsights";
import { TimeChart } from "../components/charts/TimeChart";
import { AGENT_ICON } from "../components/activity/ActivityRowItem";
import { AssetTable } from "../components/costs/AssetTable";
import { BudgetCard } from "../components/costs/BudgetCard";
import { KindSplit } from "../components/costs/KindSplit";
import { PlanCosts } from "../components/costs/PlanCosts";
import { BarList } from "../components/shared/BarList";
import { monthLabel, shiftMonth, usd } from "../lib/format";

const thisMonth = () => new Date().toISOString().slice(0, 7);

/** Every day of the month, with zero for days nothing was spent. */
function fillMonth(month: string, byDay: { date: string; cost: number }[]) {
  const first = `${month}-01`;
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const map = new Map(byDay.map((d) => [d.date, d.cost]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(first, i);
    return { date, value: map.get(date) ?? 0 };
  });
}

/** What the agents cost: the month against the budget, per day, per agent, per asset and per week. */
export function CostsPage() {
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading, error } = useCosts(month);
  const current = month === thisMonth();
  const daily = useMemo(() => (data ? fillMonth(month, data.byDay) : []), [data, month]);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader
        eyebrow="Insights"
        title="Costs"
        description="What the agents spent on AI, images, video, voice and research. Months are in UTC."
        actions={
          <div className="flex items-center rounded-ob-md border border-ob-line bg-ob-surface p-1 shadow-ob-xs">
            <button type="button" aria-label="Previous month" className={button({ variant: "quiet", size: "iconSm" })} onClick={() => setMonth((m) => shiftMonth(m, -1))}>
              <ChevronLeft size={16} />
            </button>
            <span className="min-w-[132px] text-center text-[13.5px] font-bold">{monthLabel(month)}</span>
            <button type="button" aria-label="Next month" className={button({ variant: "quiet", size: "iconSm" })} disabled={current} onClick={() => setMonth((m) => shiftMonth(m, 1))}>
              <ChevronRight size={16} />
            </button>
          </div>
        }
      />

      {error && <Alert tone="error">{error.message}</Alert>}

      {isLoading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-40" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : (
        <>
          <BudgetCard data={data} current={current} />
          {data.total === 0 ? (
            <EmptyState icon={Coins} title="Nothing spent this month" description="Costs appear as soon as an agent researches, plans or makes something." />
          ) : (
            <>
              <KindSplit data={data} />
              <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
                <Card title="Spend per day" description={monthLabel(month)}>
                  <TimeChart data={daily} kind="column" format={(n) => usd(n)} />
                </Card>
                <Card title="By agent" description="Including steps that failed (money spent still counts).">
                  <BarList
                    items={data.byAgent.map((a) => {
                      const Icon = AGENT_ICON[a.agent];
                      return {
                        key: a.agent,
                        label: (
                          <>
                            {Icon && <Icon size={14} className="shrink-0 text-ob-muted" />}
                            <span className="truncate">{AGENT_NAMES[a.agent] ?? a.agent}</span>
                          </>
                        ),
                        value: a.cost,
                        display: usd(a.cost),
                        note: `${a.steps} steps`,
                      };
                    })}
                  />
                </Card>
              </div>
              <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                <AssetTable items={data.byMedia} />
                <PlanCosts plans={data.byPlan} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
