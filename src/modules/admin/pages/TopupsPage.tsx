"use client";

import { useState } from "react";
import Link from "next/link";
import { ReceiptText } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { CreditAmount } from "@/components/kit/Credits";
import { EmptyState } from "@/components/kit/EmptyState";
import { MonthPicker, thisMonth } from "@/components/kit/MonthPicker";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { formatCredits } from "@/config/credits";
import { StatTile } from "@/modules/insights/components/shared/StatTile";
import { useAdminTopups } from "../hooks/useAdmin";
import { dateTime, money } from "../components/parts";

/** Every time credits were added or removed in a month, with what was paid: the payments record. */
export function TopupsPage() {
  const [month, setMonth] = useState(thisMonth);
  const { data, isLoading, error } = useAdminTopups(month);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Top-ups" description="Credits added or removed, with what each client paid." actions={<MonthPicker month={month} onChange={setMonth} />} />

      {error && <Alert tone="error">{error.message}</Alert>}

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <StatTile label="Money in" value={money(data.revenue)} />
            <StatTile label="Credits added (net)" value={formatCredits(data.credits)} />
            <StatTile label="Top-ups" value={String(data.rows.filter((r) => r.kind === "topup").length)} />
          </div>
          {!data.rows.length ? (
            <EmptyState icon={ReceiptText} title="No top-ups this month" description="Credits you add to a business show here, with the amount they paid." />
          ) : (
            <section className="rounded-ob-lg border border-ob-line bg-ob-surface shadow-ob-xs">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-[13.5px]">
                  <thead>
                    <tr className="text-left text-[11.5px] font-bold uppercase tracking-[0.06em] text-ob-faint">
                      <th className="px-5 py-3 font-bold">When</th>
                      <th className="px-3 py-3 font-bold">Business</th>
                      <th className="px-3 py-3 text-right font-bold">Credits</th>
                      <th className="px-3 py-3 text-right font-bold">Paid</th>
                      <th className="px-3 py-3 font-bold">Note</th>
                      <th className="px-5 py-3 font-bold">By</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((r) => (
                      <tr key={r.id} className="border-t border-ob-line">
                        <td className="whitespace-nowrap px-5 py-3 text-ob-muted">{dateTime(r.createdAt)}</td>
                        <td className="px-3 py-3">
                          <Link href={`/admin/businesses/${r.businessId}`} className="flex min-w-0 flex-col hover:text-ob-primary">
                            <span className="truncate font-bold">{r.name}</span>
                            <span className="truncate text-[12px] text-ob-muted">{r.email}</span>
                          </Link>
                        </td>
                        <td className="px-3 py-3 text-right">
                          <CreditAmount value={r.credits} size={14} signed className={r.credits > 0 ? "font-bold text-ob-success" : "font-bold text-ob-danger"} />
                        </td>
                        <td className="px-3 py-3 text-right tabular-nums">{r.amountUsd !== null ? money(r.amountUsd) : "—"}</td>
                        <td className="max-w-[260px] truncate px-3 py-3 text-ob-muted">{r.note ?? "—"}</td>
                        <td className="truncate px-5 py-3 text-ob-muted">{r.by ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
