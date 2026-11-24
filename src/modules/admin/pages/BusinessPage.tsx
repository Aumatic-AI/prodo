"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, CalendarRange, Coins, KeyRound, Plus, Receipt, ShieldCheck, Wallet } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { Card } from "@/components/kit/Card";
import { CreditAmount } from "@/components/kit/Credits";
import { Field } from "@/components/kit/Field";
import { NumberInput } from "@/components/kit/inputs";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { formatCredits, CREDIT_USD } from "@/config/credits";
import { addDays } from "@/lib/zoned-time";
import { BarList } from "@/modules/insights/components/shared/BarList";
import { Segmented } from "@/modules/insights/components/shared/Segmented";
import { StatTile } from "@/modules/insights/components/shared/StatTile";
import { TimeChart } from "@/modules/insights/components/charts/TimeChart";
import { useAdminBusiness, useSetBudget } from "../hooks/useAdmin";
import { CreditsModal } from "../components/CreditsModal";
import { PasswordModal } from "../components/PasswordModal";
import { MonthBars } from "../components/MonthBars";
import { BusinessMark, StatusBadge, ago, businessName, dateShort, dateTime, money } from "../components/parts";

/** Every day of the last 30, with zero where nothing was used */
function last30(points: { bucket: string; used: number }[]) {
  const map = new Map(points.map((p) => [p.bucket.slice(0, 10), p.used]));
  const today = new Date().toISOString().slice(0, 10);
  return Array.from({ length: 30 }, (_, i) => {
    const date = addDays(today, i - 29);
    return { date, value: map.get(date) ?? 0 };
  });
}

/** One business for the admin: balance, use (high level), money paid, our cost, top-ups, and its login. */
export function BusinessPage({ id }: { id: string }) {
  const { data, isLoading, error } = useAdminBusiness(id);
  const [topUp, setTopUp] = useState(false);
  const [password, setPassword] = useState(false);
  const [range, setRange] = useState<"month" | "all">("month");

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (isLoading || !data) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-32" />
        <Skeleton className="h-80" />
      </div>
    );
  }

  const b = data.business;
  const categories = range === "month" ? data.month.byCategory : data.allTime.byCategory;
  const valueUsed = b.usedMonth * CREDIT_USD;

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin/businesses" className="inline-flex w-fit items-center gap-1.5 text-[13px] font-semibold text-ob-muted hover:text-ob-ink">
        <ArrowLeft size={15} /> Businesses
      </Link>

      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <BusinessMark business={b} size={52} />
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="m-0 truncate text-[26px] font-extrabold tracking-tight">{businessName(b)}</h1>
              <StatusBadge business={b} />
            </div>
            <span className="truncate text-sm text-ob-muted">
              {b.email ?? "No login"} · added {dateShort(b.createdAt)} · active {ago(b.lastActive).toLowerCase()}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setPassword(true)}>
            <KeyRound size={15} /> Change password
          </button>
          <button type="button" className={button({ size: "sm" })} onClick={() => setTopUp(true)}>
            <Plus size={15} /> Add credits
          </button>
        </div>
      </header>

      {b.feesDue && (
        <Alert tone="error">
          Publishing is paused: the monthly fee for {b.feesDue.label} ({formatCredits(b.feesDue.credits)} credits) couldn&rsquo;t be taken. Adding credits takes it and starts publishing again.
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Credits left" value={formatCredits(b.credits)} icon={Wallet} hint={`${formatCredits(b.addedTotal)} added in all`} />
        <StatTile label="Used this month" value={formatCredits(b.usedMonth)} icon={CalendarRange} hint={`${formatCredits(b.used30d)} in the last 30 days`} />
        <StatTile label="Paid in all" value={money(b.paidUsd, 0)} icon={Receipt} hint={b.lastTopupAt ? `last top-up ${dateShort(b.lastTopupAt)}` : "no top-ups yet"} />
        <StatTile label="Our AI cost this month" value={money(b.costMonth)} icon={Coins} hint={valueUsed ? `${Math.round(((valueUsed - b.costMonth) / valueUsed) * 100)}% margin on credits used` : undefined} />
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Card title="Credits used" description="The last 30 days">
          <TimeChart data={last30(data.daily)} kind="column" format={(n) => formatCredits(n)} />
        </Card>
        <Card title="Used on" actions={<Segmented label="Period" value={range} onChange={setRange} options={[{ value: "month", label: "This month" }, { value: "all", label: "All time" }]} />}>
          <BarList
            empty="Nothing used yet."
            items={categories.map((c) => ({ key: c.key, label: c.label, value: c.used, display: formatCredits(c.used), note: `${c.uses} ${c.uses === 1 ? "time" : "times"}` }))}
          />
        </Card>
      </div>

      <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card title="By month" description="Credits used and added, money paid and what the agents cost us.">
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[480px] border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] font-bold uppercase tracking-[0.06em] text-ob-faint">
                  <th className="px-2 pb-2 font-bold">Month</th>
                  <th className="px-2 pb-2 text-right font-bold">Used</th>
                  <th className="px-2 pb-2 text-right font-bold">Added</th>
                  <th className="px-2 pb-2 text-right font-bold">Paid</th>
                  <th className="px-2 pb-2 text-right font-bold">AI cost</th>
                </tr>
              </thead>
              <tbody>
                {[...data.monthly].reverse().map((m) => (
                  <tr key={m.bucket} className="border-t border-ob-line">
                    <td className="px-2 py-2.5 font-semibold">{new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${m.bucket.slice(0, 7)}-15T12:00:00Z`))}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatCredits(m.used)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{formatCredits(m.added)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums">{money(m.paid)}</td>
                    <td className="px-2 py-2.5 text-right tabular-nums text-ob-muted">{money(m.aiCost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-5">
            <MonthBars
              data={data.monthly}
              format={(n) => formatCredits(n)}
              series={[
                { key: "used", label: "Credits used", color: "var(--color-ob-primary)" },
                { key: "added", label: "Credits added", color: "var(--color-ob-success)" },
              ]}
              height={200}
            />
          </div>
        </Card>
        <div className="flex flex-col gap-5">
          <Card title="Top-ups" description="Every time credits were added or removed.">
            {data.topups.length ? (
              <ul className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
                {data.topups.map((t) => (
                  <li key={t.id} className="flex items-start justify-between gap-3 py-2.5">
                    <span className="flex min-w-0 flex-col">
                      <span className="text-[13.5px] font-semibold">
                        {t.amount_usd !== null ? money(t.amount_usd) : t.kind === "adjust" ? "Removed" : "No amount"}
                        {t.note && <span className="font-normal text-ob-muted"> · {t.note}</span>}
                      </span>
                      <span className="text-[12px] text-ob-muted">
                        {dateTime(t.created_at)}
                        {t.by && ` · ${t.by}`}
                      </span>
                    </span>
                    <span className={t.credits > 0 ? "font-bold text-ob-success" : "font-bold text-ob-danger"}>
                      <CreditAmount value={t.credits} size={14} signed />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="m-0 text-sm text-ob-muted">No credits added yet.</p>
            )}
          </Card>
          <SafetyCap businessId={b.id} budgetUsd={b.budgetUsd} spent={b.costMonth} />
        </div>
      </div>

      <CreditsModal business={topUp ? b : null} onClose={() => setTopUp(false)} />
      <PasswordModal businessId={b.id} email={b.email} open={password} onOpenChange={setPassword} />
    </div>
  );
}

/** The monthly AI safety cap: our cost, in dollars. The agents stop for the month when it's reached. */
function SafetyCap({ businessId, budgetUsd, spent }: { businessId: string; budgetUsd: number; spent: number }) {
  const save = useSetBudget(businessId);
  const [value, setValue] = useState<number | null>(budgetUsd);
  const used = budgetUsd ? Math.min(100, Math.round((spent / budgetUsd) * 100)) : 0;
  const dirty = value !== budgetUsd;
  return (
    <Card title="Monthly safety cap" description="Our AI cost for this business. The agents stop for the month when it's reached, whatever credits are left.">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px]">
            <span className="font-semibold">{money(spent)} this month</span>
            <span className="text-ob-muted">{used}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-ob-sunken">
            <div className={used >= 90 ? "h-full rounded-full bg-ob-danger" : used >= 70 ? "h-full rounded-full bg-ob-warn" : "h-full rounded-full bg-ob-primary"} style={{ width: `${Math.max(2, used)}%` }} />
          </div>
        </div>
        <div className="flex items-end gap-2">
          <Field label="Cap (USD)" htmlFor="cap" className="flex-1" error={save.error?.message}>
            <NumberInput id="cap" prefix="$" min={1} value={value} onValueChange={setValue} />
          </Field>
          <button type="button" className={button({ variant: "secondary" })} disabled={!dirty || !value || value < 1 || save.isPending} onClick={() => value && save.mutate(value)}>
            <ShieldCheck size={16} /> {save.isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </Card>
  );
}
