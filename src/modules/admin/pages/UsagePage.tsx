"use client";

import { useState } from "react";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { EmptyState } from "@/components/kit/EmptyState";
import { MonthPicker, thisMonth } from "@/components/kit/MonthPicker";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { CREDIT_CATEGORIES, CREDIT_USD, formatCredits } from "@/config/credits";
import { cn } from "@/lib/utils";
import { useAdminUsage } from "../hooks/useAdmin";
import { money } from "../components/parts";

// One colour per kind of work, for the share bar (theme tokens only)
const SHADES: Record<string, string> = {
  images: "bg-ob-primary",
  videos: "bg-ob-dark",
  plans: "bg-ob-success",
  brand: "bg-ob-warn",
  accounts: "bg-ob-danger",
  text: "bg-ob-muted",
  other: "bg-ob-line-strong",
};

/** One month, high level: credits each business used, split by kind of work, against what it cost us. */
export function UsagePage() {
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading, error } = useAdminUsage(month);
  const columns = CREDIT_CATEGORIES.filter((c) => data?.categories.some((x) => x.key === c.key));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Usage" description="Credits each business used, by kind of work. Refunds for failed work are taken off." actions={<MonthPicker month={month} onChange={setMonth} />} />

      {error && <Alert tone="error">{error.message}</Alert>}

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : !data.rows.length ? (
        <EmptyState icon={BarChart3} title="Nothing used this month" description="Usage shows here as soon as a business makes something." />
      ) : (
        <>
          <section className="flex flex-col gap-4 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <span className="text-[13px] font-semibold text-ob-muted">Credits used by every business</span>
              <strong className="text-2xl font-extrabold tabular-nums">{formatCredits(data.total)}</strong>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-ob-sunken">
              {data.categories.map((c) => (
                <div key={c.key} className={cn("h-full", SHADES[c.key])} style={{ width: `${data.total ? (Math.max(0, c.used) / data.total) * 100 : 0}%` }} title={`${c.label}: ${formatCredits(c.used)}`} />
              ))}
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[12.5px]">
              {data.categories.map((c) => (
                <span key={c.key} className="flex items-center gap-1.5 text-ob-muted">
                  <span className={cn("size-2.5 rounded-full", SHADES[c.key])} />
                  {c.label} <strong className="tabular-nums text-ob-ink">{formatCredits(c.used)}</strong>
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-ob-lg border border-ob-line bg-ob-surface shadow-ob-xs">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] border-collapse text-[13.5px]">
                <thead>
                  <tr className="text-left text-[11.5px] font-bold uppercase tracking-[0.06em] text-ob-faint">
                    <th className="px-5 py-3 font-bold">Business</th>
                    <th className="px-3 py-3 text-right font-bold">Used</th>
                    {columns.map((c) => (
                      <th key={c.key} className="px-3 py-3 text-right font-bold">
                        {c.label}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right font-bold">AI cost</th>
                    <th className="px-5 py-3 text-right font-bold">Left</th>
                  </tr>
                </thead>
                <tbody>
                  {data.rows.map((r) => (
                    <tr key={r.id} className="border-t border-ob-line">
                      <td className="px-5 py-3">
                        <Link href={`/admin/businesses/${r.id}`} className="flex min-w-0 flex-col hover:text-ob-primary">
                          <span className="truncate font-bold">{r.name}</span>
                          <span className="truncate text-[12px] text-ob-muted">{r.email}</span>
                        </Link>
                      </td>
                      <td className="px-3 py-3 text-right font-bold tabular-nums">{formatCredits(r.used)}</td>
                      {columns.map((c) => {
                        const v = r.byCategory.find((x) => x.key === c.key);
                        return (
                          <td key={c.key} className="px-3 py-3 text-right tabular-nums text-ob-muted">
                            {v ? formatCredits(v.used) : "—"}
                          </td>
                        );
                      })}
                      <td className={cn("px-3 py-3 text-right tabular-nums", r.aiCost > r.used * CREDIT_USD ? "font-semibold text-ob-danger" : "text-ob-muted")}>{money(r.aiCost)}</td>
                      <td className="px-5 py-3 text-right tabular-nums">{formatCredits(r.credits)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <p className="m-0 text-[12.5px] text-ob-muted">AI cost in red: the agents cost us more than the credits used were worth at ${CREDIT_USD.toFixed(2)} each.</p>
        </>
      )}
    </div>
  );
}
