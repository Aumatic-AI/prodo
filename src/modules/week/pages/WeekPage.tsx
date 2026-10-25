"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PlanItemView } from "@/core/plans/types";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight, MoreHorizontal, RotateCcw, Sparkles } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { addDays } from "@/lib/zoned-time";
import { cn } from "@/lib/utils";
import { ActivityFeed } from "../components/ActivityFeed";
import { CreateAdModal } from "../components/CreateAdModal";
import { EmptyWeek } from "../components/EmptyWeek";
import { NeedsYou } from "../components/NeedsYou";
import { PlanBanner } from "../components/PlanBanner";
import { SlotDetail } from "../components/slot/SlotDetail";
import { StrategyCard } from "../components/StrategyCard";
import { WeekBoard } from "../components/WeekBoard";
import { isBusy, useActivity, usePlan, useRequestPlan } from "../hooks/usePlan";
import { weekRange } from "../lib/time";

/** This week: the plan on a board, what needs approval, and what the agents are doing. */
export function WeekPage() {
  const router = useRouter();
  const params = useSearchParams();
  const week = params.get("week") ?? "this";
  const itemId = params.get("item");
  const [requested, setRequested] = useState(false);
  const [creating, setCreating] = useState(false);
  const [menu, setMenu] = useState(false);

  const { data, isLoading, error } = usePlan(week, requested);
  const plan = data?.plan ?? null;
  const busy = isBusy(plan);
  const activity = useActivity({ planId: plan?.id }, busy);
  const again = useRequestPlan();

  const go = (next: Record<string, string | null>) => {
    const q = new URLSearchParams(params.toString());
    for (const [k, v] of Object.entries(next)) {
      if (v) q.set(k, v);
      else q.delete(k);
    }
    router.replace(`/week${q.size ? `?${q}` : ""}`, { scroll: false });
  };
  const shift = (days: number) => data && go({ week: addDays(data.weekStart, days), item: null });

  const clock = data?.clock;
  const isThis = data && clock && data.weekStart === clock.thisWeek;
  const isNext = data && clock && data.weekStart === clock.nextWeek;
  const label = isThis ? "This week" : isNext ? "Next week" : "Week";
  const latest = activity.data?.find((r) => r.summary)?.summary ?? null;
  const open = plan?.items.find((i) => i.id === itemId) ?? null;

  // A link to a post in another week (calendar, notifications): jump to that week
  const linked = useQuery<PlanItemView>({
    queryKey: ["plan-item", itemId],
    queryFn: () => apiFetch(`/api/plan-items/${itemId}`),
    enabled: !!itemId && !!data && !open,
  });
  const linkedDay = linked.data?.slot_at.slice(0, 10);
  useEffect(() => {
    if (linkedDay && data && !open && (linkedDay < data.weekStart || linkedDay > addDays(data.weekStart, 6))) go({ week: linkedDay });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [linkedDay, data?.weekStart, open]);
  const canReplan = plan && !busy && !plan.items.some((i) => ["approved", "scheduled", "published"].includes(i.status));

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow={data ? weekRange(data.weekStart) : undefined}
        title={label}
        description="Your plan, what needs your approval, and what the agents are doing."
        actions={
          <>
            <div className="flex w-full items-center justify-between rounded-ob-md border border-ob-line bg-ob-surface p-1 shadow-ob-xs sm:w-auto sm:justify-start">
              <button type="button" aria-label="Previous week" className={button({ variant: "quiet", size: "iconSm" })} onClick={() => shift(-7)} disabled={!data}>
                <ChevronLeft size={16} />
              </button>
              <button type="button" className={cn(button({ variant: "quiet", size: "xs" }), isThis && "text-ob-primary")} onClick={() => go({ week: null, item: null })}>
                This week
              </button>
              <button type="button" className={cn(button({ variant: "quiet", size: "xs" }), isNext && "text-ob-primary")} onClick={() => go({ week: "next", item: null })}>
                Next week
              </button>
              <button type="button" aria-label="Next week" className={button({ variant: "quiet", size: "iconSm" })} onClick={() => shift(7)} disabled={!data}>
                <ChevronRight size={16} />
              </button>
            </div>
            <button type="button" className={button({ size: "sm" })} onClick={() => setCreating(true)}>
              <Sparkles size={15} /> Create an ad
            </button>
            {canReplan && (
              <div className="relative">
                <button type="button" aria-label="More" className={button({ variant: "secondary", size: "icon" })} onClick={() => setMenu((m) => !m)}>
                  <MoreHorizontal size={16} />
                </button>
                {menu && (
                  <div className="absolute right-0 top-11 z-20 w-56 rounded-ob-md border border-ob-line bg-ob-surface p-1.5 shadow-ob-md">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-ob px-3 py-2 text-left text-sm font-semibold hover:bg-ob-sunken"
                      onClick={() => {
                        setMenu(false);
                        again.mutate({ week: plan!.week_start, replace: true }, { onSuccess: () => setRequested(true) });
                      }}
                    >
                      <RotateCcw size={15} /> Plan this week again
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        }
      />

      {error && <Alert tone="error">{error.message}</Alert>}
      {again.error && <Alert tone="error">{again.error.message}</Alert>}

      {isLoading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-24" />
          <div className="hidden grid-cols-7 gap-3 md:grid">
            {Array.from({ length: 7 }, (_, i) => (
              <Skeleton key={i} className="h-72" />
            ))}
          </div>
          <div className="flex flex-col gap-3 md:hidden">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        </div>
      ) : !plan ? (
        <EmptyWeek
          weekStart={data.weekStart}
          isPast={data.weekStart < data.clock.thisWeek}
          lastDay={data.weekStart === data.clock.thisWeek && data.clock.today >= addDays(data.clock.thisWeek, 6)}
          requested={requested}
          onRequested={() => setRequested(true)}
          onCreateAd={() => setCreating(true)}
          onPlanNext={() =>
            again.mutate(
              { week: "next" },
              {
                onSuccess: () => {
                  setRequested(true);
                  go({ week: "next", item: null });
                },
              }
            )
          }
        />
      ) : (
        <>
          <PlanBanner plan={plan} latest={busy ? latest : null} />
          <WeekBoard weekStart={data.weekStart} items={plan.items} today={data.clock.today} timezone={data.clock.timezone} onOpen={(id) => go({ item: id })} />
          {/* One column on phones, two on tablets (theme across the top), three on wide screens */}
          <div className="grid grid-cols-1 items-start gap-5 md:grid-cols-2 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div className="min-w-0 md:col-span-2 xl:col-span-1">
              <StrategyCard plan={plan} />
            </div>
            <NeedsYou items={plan.items} timezone={data.clock.timezone} onOpen={(id) => go({ item: id })} />
            <ActivityFeed rows={activity.data} loading={activity.isLoading} />
          </div>
        </>
      )}

      <SlotDetail item={open} timezone={data?.clock.timezone ?? "UTC"} onClose={() => go({ item: null })} />
      <CreateAdModal
        open={creating}
        onOpenChange={setCreating}
        onCreated={(id, slotAt) => {
          // The ad joins the plan of the week it goes out in
          go({ week: slotAt.slice(0, 10), item: id });
        }}
      />
    </div>
  );
}
