"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Plus, Search, UserPlus } from "lucide-react";
import { PageHeader } from "@/components/kit/PageHeader";
import { Alert } from "@/components/kit/Alert";
import { EmptyState } from "@/components/kit/EmptyState";
import { Skeleton } from "@/components/kit/Skeleton";
import { TextInput } from "@/components/kit/inputs";
import { CreditAmount } from "@/components/kit/Credits";
import { button } from "@/components/kit/styles";
import { LOW_CREDITS, formatCredits } from "@/config/credits";
import { cn } from "@/lib/utils";
import type { AdminBusiness } from "@/core/admin/businesses";
import { Segmented } from "@/modules/insights/components/shared/Segmented";
import { useAdminBusinesses } from "../hooks/useAdmin";
import { AddBusinessModal } from "../components/AddBusinessModal";
import { CreditsModal } from "../components/CreditsModal";
import { BusinessMark, StatusBadge, ago, businessName, money } from "../components/parts";

type Filter = "all" | "active" | "setup" | "low";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "setup", label: "Setting up" },
  { value: "low", label: "Need credits" },
];

const needsCredits = (b: AdminBusiness) => !!b.feesDue || (b.onboardingStatus === "done" && b.credits < LOW_CREDITS);

/** Every business: who logs in, how far it is, credits left, what it used and paid, and when it was last busy. */
export function BusinessesPage() {
  const router = useRouter();
  const { data, isLoading, error } = useAdminBusinesses();
  const [adding, setAdding] = useState(false);
  const [topUp, setTopUp] = useState<AdminBusiness | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (data ?? []).filter((b) => {
      if (q && !`${b.name} ${b.email ?? ""}`.toLowerCase().includes(q)) return false;
      if (filter === "active") return b.onboardingStatus === "done";
      if (filter === "setup") return b.onboardingStatus !== "done";
      if (filter === "low") return needsCredits(b);
      return true;
    });
  }, [data, query, filter]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Businesses"
        description="Every client account. Add a business after they pay; top up when they run low."
        actions={
          <button type="button" className={button()} onClick={() => setAdding(true)}>
            <UserPlus size={16} /> Add business
          </button>
        }
      />

      {error && <Alert tone="error">{error.message}</Alert>}

      {isLoading || !data ? (
        <Skeleton className="h-96" />
      ) : !data.length ? (
        <EmptyState
          icon={Building2}
          title="No businesses yet"
          description="Add the first one with the client's email, a password and their credits."
          action={
            <button type="button" className={button()} onClick={() => setAdding(true)}>
              <UserPlus size={16} /> Add business
            </button>
          }
        />
      ) : (
        <section className="flex flex-col rounded-ob-lg border border-ob-line bg-ob-surface shadow-ob-xs">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ob-line px-4 py-3 sm:px-5">
            <div className="relative w-full max-w-[320px]">
              <Search size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ob-faint" aria-hidden="true" />
              <TextInput value={query} onValueChange={setQuery} placeholder="Search name or email" className="min-h-10 pl-10" aria-label="Search businesses" />
            </div>
            <Segmented label="Show" value={filter} onChange={setFilter} options={FILTERS} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] border-collapse text-[13.5px]">
              <thead>
                <tr className="text-left text-[11.5px] font-bold uppercase tracking-[0.06em] text-ob-faint">
                  <th className="px-5 py-3 font-bold">Business</th>
                  <th className="px-3 py-3 font-bold">Status</th>
                  <th className="px-3 py-3 text-right font-bold">Credits left</th>
                  <th className="px-3 py-3 text-right font-bold">Used (30 days)</th>
                  <th className="px-3 py-3 text-right font-bold">Posts (30 days)</th>
                  <th className="px-3 py-3 text-right font-bold">Paid</th>
                  <th className="px-3 py-3 font-bold">Last active</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody>
                {shown.map((b) => (
                  <tr key={b.id} className="cursor-pointer border-t border-ob-line transition-colors hover:bg-ob-sunken/60" onClick={() => router.push(`/admin/businesses/${b.id}`)}>
                    <td className="px-5 py-3">
                      <Link href={`/admin/businesses/${b.id}`} className="flex min-w-0 items-center gap-3" onClick={(e) => e.stopPropagation()}>
                        <BusinessMark business={b} />
                        <span className="flex min-w-0 flex-col">
                          <span className="truncate font-bold text-ob-ink">{businessName(b)}</span>
                          <span className="truncate text-[12px] text-ob-muted">{b.email ?? "No login"}</span>
                        </span>
                      </Link>
                    </td>
                    <td className="px-3 py-3">
                      <StatusBadge business={b} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={cn("inline-flex justify-end font-bold", needsCredits(b) ? "text-ob-danger" : "text-ob-ink")}>
                        <CreditAmount value={b.credits} size={14} />
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{formatCredits(b.used30d)}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{b.posts30d}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{money(b.paidUsd, 0)}</td>
                    <td className="px-3 py-3 text-ob-muted">{ago(b.lastActive)}</td>
                    <td className="px-5 py-3 text-right">
                      <button
                        type="button"
                        className={button({ variant: "secondary", size: "xs" })}
                        onClick={(e) => {
                          e.stopPropagation();
                          setTopUp(b);
                        }}
                      >
                        <Plus size={14} /> Credits
                      </button>
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-ob-muted">
                      No businesses match.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <AddBusinessModal open={adding} onOpenChange={setAdding} />
      <CreditsModal business={topUp} onClose={() => setTopUp(null)} />
    </div>
  );
}
