"use client";

import { useMemo, useState } from "react";
import { BookOpen, CalendarRange, FileText, Images, Link2, MoreHorizontal, Video, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { Card } from "@/components/kit/Card";
import { CreditAmount, CreditIcon } from "@/components/kit/Credits";
import { MonthPicker, monthLabel, thisMonth } from "@/components/kit/MonthPicker";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { addDays } from "@/lib/zoned-time";
import { formatCredits, type CreditCategory } from "@/config/credits";
import { useCredits } from "../hooks/useInsights";
import { TimeChart } from "../components/charts/TimeChart";
import { BarList } from "../components/shared/BarList";
import { StatTile } from "../components/shared/StatTile";
import { BalanceCard } from "../components/credits/BalanceCard";
import { CreditHistory } from "../components/credits/CreditHistory";

const CATEGORY_ICON: Record<CreditCategory | "other", LucideIcon> = {
  images: Images,
  videos: Video,
  plans: CalendarRange,
  brand: BookOpen,
  accounts: Link2,
  text: FileText,
  other: MoreHorizontal,
};

/** Every day of the month, with zero for days nothing was used. */
function fillMonth(month: string, byDay: { date: string; used: number }[]) {
  const first = `${month}-01`;
  const days = new Date(Date.UTC(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0)).getUTCDate();
  const map = new Map(byDay.map((d) => [d.date, d.used]));
  return Array.from({ length: days }, (_, i) => {
    const date = addDays(first, i);
    return { date, value: map.get(date) ?? 0 };
  });
}

/** The client's credits: balance, what the month used them on, every change, and what things cost. */
export function CreditsPage() {
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading, error } = useCredits(month);
  const current = month === thisMonth();
  const daily = useMemo(() => (data ? fillMonth(month, data.byDay) : []), [data, month]);

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader eyebrow="Insights" title="Credits" description="What your credits were used on. Months are in UTC." actions={<MonthPicker month={month} onChange={setMonth} />} />

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
          <BalanceCard data={data} current={current} />

          {data.byCategory.length > 0 && (
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              {data.byCategory.slice(0, 4).map((c) => (
                <StatTile
                  key={c.key}
                  label={c.label}
                  value={formatCredits(c.used)}
                  icon={CATEGORY_ICON[c.key]}
                  hint={`${c.uses} ${c.uses === 1 ? "time" : "times"} · ${data.used ? Math.round((c.used / data.used) * 100) : 0}%`}
                />
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Card title="Credits used per day" description={monthLabel(month)}>
              <TimeChart data={daily} kind="column" format={(n) => formatCredits(n)} />
            </Card>
            <Card title="Used on" description="Credits returned for failed work are taken off.">
              <BarList
                empty="Nothing used this month."
                items={data.byAction
                  .filter((a) => a.used > 0)
                  .map((a) => ({ key: a.action, label: <span className="truncate">{a.label}</span>, value: a.used, display: formatCredits(a.used), note: `${a.uses} ${a.uses === 1 ? "time" : "times"}` }))}
              />
            </Card>
          </div>

          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <CreditHistory rows={data.history} />
            <Card title="What things cost" description="Captions, uploads, editing, scheduling, publishing and the Ad library are free.">
              <ul className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
                {data.prices.map((p) => (
                  <li key={p.action} className="flex items-center justify-between gap-3 py-2.5 text-[13.5px]">
                    <span className="min-w-0 truncate text-ob-ink">{p.label}</span>
                    <CreditAmount value={p.credits} size={14} className="shrink-0 font-bold" />
                  </li>
                ))}
              </ul>
              <p className="m-0 mt-3 flex items-center gap-1.5 text-[12px] text-ob-muted">
                <CreditIcon size={13} /> Making something again costs its credits again. Quality checks and their redos are included.
              </p>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}
