"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Building2, Coins, Plus, Receipt, Sparkles, TrendingUp, Wallet } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { Card } from "@/components/kit/Card";
import { CreditAmount } from "@/components/kit/Credits";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { CREDIT_USD, formatCredits } from "@/config/credits";
import { addDays } from "@/lib/zoned-time";
import type { AdminBusiness } from "@/core/admin/businesses";
import { BarList } from "@/modules/insights/components/shared/BarList";
import { StatTile } from "@/modules/insights/components/shared/StatTile";
import { TimeChart } from "@/modules/insights/components/charts/TimeChart";
import { change } from "@/modules/insights/lib/format";
import { useAdminDashboard } from "../hooks/useAdmin";
import { AddBusinessModal } from "../components/AddBusinessModal";
import { CreditsModal } from "../components/CreditsModal";
import { MonthBars } from "../components/MonthBars";
import { BusinessMark, ago, businessName, money } from "../components/parts";

/** The whole business at a glance: money in, credits used, what the agents cost us, and who needs attention. */
export function AdminDashboardPage() {
  const { data, isLoading, error } = useAdminDashboard();
  const [adding, setAdding] = useState(false);
  const [topUp, setTopUp] = useState<AdminBusiness | null>(null);

  const header = (
    <PageHeader
      title="Dashboard"
      description="This month so far, compared with the same days last month. Months are in UTC."
      actions={
        <button type="button" className={button()} onClick={() => setAdding(true)}>
          <Plus size={16} /> Add business
        </button>
      }
    />
  );

  if (error)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <Alert tone="error">{error.message}</Alert>
      </div>
    );

  if (isLoading || !data)
    return (
      <div className="flex flex-col gap-6">
        {header}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );

  const t = data.thisMonth;
  const l = data.lastMonth;
  const margin = t.creditsUsed * CREDIT_USD - t.aiCost;
  const lastMargin = l.creditsUsed * CREDIT_USD - l.aiCost;
  const today = new Date().toISOString().slice(0, 10);
  const used = new Map(data.daily.map((p) => [p.bucket.slice(0, 10), p.used]));
  const daily = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(today, i - 29);
    return { date, value: used.get(date) ?? 0 };
  });

  return (
    <div className="flex flex-col gap-6">
      {header}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Money in" value={money(t.revenue, 0)} icon={Receipt} delta={change(t.revenue, l.revenue)} hint={`${formatCredits(t.creditsAdded)} credits added`} />
        <StatTile label="Credits used" value={formatCredits(t.creditsUsed)} icon={Sparkles} delta={change(t.creditsUsed, l.creditsUsed)} hint={`worth ${money(t.creditsUsed * CREDIT_USD, 0)}`} />
        <StatTile label="AI cost (ours)" value={money(t.aiCost, 0)} icon={Coins} delta={change(t.aiCost, l.aiCost)} invert hint="every agent step" />
        <StatTile
          label="Margin on usage"
          value={money(margin, 0)}
          icon={TrendingUp}
          delta={change(margin, lastMargin)}
          hint={t.creditsUsed ? `${Math.round((margin / (t.creditsUsed * CREDIT_USD)) * 100)}% of credits used` : "nothing used yet"}
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <MiniStat icon={Building2} label="Businesses" value={`${data.businesses.active} active`} note={data.businesses.settingUp ? `${data.businesses.settingUp} setting up` : "none setting up"} />
        <MiniStat icon={Wallet} label="Credits held by clients" value={formatCredits(data.businesses.creditsHeld)} note={`worth ${money(data.businesses.creditsHeld * CREDIT_USD, 0)} of work still to do`} />
        <MiniStat
          icon={Coins}
          label="Need credits"
          value={`${data.businesses.lowBalance + data.businesses.feesDue}`}
          note={data.businesses.feesDue ? `${data.businesses.feesDue} with publishing paused` : "low balance"}
          tone={data.businesses.feesDue ? "danger" : data.businesses.lowBalance ? "warn" : undefined}
        />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Credits used" description="Every business, the last 30 days">
          <TimeChart data={daily} kind="area" format={(n) => formatCredits(n)} />
        </Card>
        <Card title="Used on" description="This month, every business">
          <BarList empty="Nothing used this month." items={data.byCategory.map((c) => ({ key: c.key, label: c.label, value: c.used, display: formatCredits(c.used), note: `${c.uses} ${c.uses === 1 ? "time" : "times"}` }))} />
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Money in and AI cost" description="The last 6 months">
          <MonthBars
            data={data.monthly}
            format={(n) => money(n, 0)}
            series={[
              { key: "paid", label: "Money in", color: "var(--color-ob-primary)" },
              { key: "aiCost", label: "AI cost", color: "var(--color-ob-warn)" },
            ]}
          />
        </Card>
        <Card title="Top users this month">
          <BarList
            empty="Nothing used this month."
            items={data.topUsers.map((u) => ({
              key: u.id,
              label: (
                <Link href={`/admin/businesses/${u.id}`} className="truncate hover:text-ob-primary">
                  {u.name}
                </Link>
              ),
              value: u.used,
              display: formatCredits(u.used),
            }))}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-2">
        <Card
          title="Need credits"
          description="Low on credits, or publishing paused by an unpaid monthly fee."
          actions={
            <Link href="/admin/businesses" className={button({ variant: "ghost", size: "sm" })}>
              All businesses <ArrowRight size={14} />
            </Link>
          }
        >
          {data.needCredits.length ? (
            <ul className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
              {data.needCredits.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <BusinessMark business={b} size={32} />
                  <Link href={`/admin/businesses/${b.id}`} className="flex min-w-0 flex-1 flex-col hover:text-ob-primary">
                    <span className="truncate text-[13.5px] font-semibold">{businessName(b)}</span>
                    <span className="truncate text-[12px] text-ob-muted">{b.feesDue ? `Fee of ${formatCredits(b.feesDue.credits)} due` : `active ${ago(b.lastActive).toLowerCase()}`}</span>
                  </Link>
                  <CreditAmount value={b.credits} size={14} className={b.feesDue ? "font-bold text-ob-danger" : "font-bold text-ob-warn"} />
                  <button type="button" className={button({ variant: "secondary", size: "xs" })} onClick={() => setTopUp(b)}>
                    <Plus size={14} /> Credits
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-ob-muted">Everyone has enough credits.</p>
          )}
        </Card>
        <Card
          title="Recent top-ups"
          actions={
            <Link href="/admin/topups" className={button({ variant: "ghost", size: "sm" })}>
              All top-ups <ArrowRight size={14} />
            </Link>
          }
        >
          {data.recentTopups.length ? (
            <ul className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
              {data.recentTopups.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/businesses/${r.businessId}`} className="flex min-w-0 flex-col hover:text-ob-primary">
                    <span className="truncate text-[13.5px] font-semibold">{r.name}</span>
                    <span className="text-[12px] text-ob-muted">
                      {ago(r.createdAt)}
                      {r.amountUsd !== null && ` · ${money(r.amountUsd)}`}
                    </span>
                  </Link>
                  <CreditAmount value={r.credits} size={14} signed className="font-bold text-ob-success" />
                </li>
              ))}
            </ul>
          ) : (
            <p className="m-0 text-sm text-ob-muted">No top-ups yet.</p>
          )}
        </Card>
      </div>

      <AddBusinessModal open={adding} onOpenChange={setAdding} />
      <CreditsModal business={topUp} onClose={() => setTopUp(null)} />
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, note, tone }: { icon: typeof Building2; label: string; value: string; note: string; tone?: "warn" | "danger" }) {
  return (
    <div className="flex items-center gap-3.5 rounded-ob-lg border border-ob-line bg-ob-surface p-4 shadow-ob-xs">
      <span
        className={
          tone === "danger"
            ? "grid size-10 shrink-0 place-items-center rounded-ob-md bg-ob-danger-soft text-ob-danger"
            : tone === "warn"
              ? "grid size-10 shrink-0 place-items-center rounded-ob-md bg-ob-warn-soft text-ob-warn"
              : "grid size-10 shrink-0 place-items-center rounded-ob-md bg-ob-primary-soft text-ob-primary"
        }
      >
        <Icon size={18} />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[12.5px] font-semibold text-ob-muted">{label}</span>
        <strong className="truncate text-lg font-extrabold tabular-nums">{value}</strong>
        <span className="truncate text-[12px] text-ob-faint">{note}</span>
      </div>
    </div>
  );
}
