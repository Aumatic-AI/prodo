"use client";

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PerformanceView } from "@/core/performance/dashboard";
import type { CreditsView } from "@/core/credits/view";
import type { CreditPrice } from "@/core/credits/prices";
import type { FeesDue } from "@/core/credits/ledger";
import type { ActivityRow } from "@/modules/week/hooks/usePlan";

export function usePerformance(days: number) {
  return useQuery<PerformanceView>({ queryKey: ["performance", days], queryFn: () => apiFetch(`/api/performance?days=${days}`) });
}

export function useLearnNow() {
  return useMutation({ mutationFn: () => apiFetch<{ started: boolean }>("/api/performance/learn", { method: "POST" }) });
}

/** The month's credits: balance, use by kind of work and by day, every change */
export function useCredits(month: string) {
  return useQuery<CreditsView>({ queryKey: ["credits", "month", month], queryFn: () => apiFetch(`/api/credits?month=${month}`) });
}

/** The balance for the sidebar; refreshed every minute and after anything that uses credits ("credits" key) */
export function useCreditBalance() {
  return useQuery<{ credits: number; feesDue: FeesDue | null }>({
    queryKey: ["credits", "balance"],
    queryFn: () => apiFetch("/api/credits/balance"),
    refetchInterval: 60_000,
    staleTime: 20_000,
  });
}

/** What each action costs, for the hints on buttons */
export function useCreditPrices() {
  return useQuery<CreditPrice[]>({ queryKey: ["credits", "prices"], queryFn: () => apiFetch("/api/credits/prices"), staleTime: 5 * 60_000 });
}

export interface ActivityFilters {
  agent: string | null;
  problemsOnly: boolean;
}

export type ActivityItem = ActivityRow & { run_id?: string | null };

const PAGE = 60;

/** The app-wide agent feed, newest first, paged by created_at. The first page refreshes every 10 s. */
export function useActivityFeed(filters: ActivityFilters) {
  return useInfiniteQuery<ActivityItem[]>({
    queryKey: ["activity-feed", filters.agent, filters.problemsOnly],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const qs = new URLSearchParams();
      if (filters.agent) qs.set("agent", filters.agent);
      if (filters.problemsOnly) qs.set("status", "failed");
      if (pageParam) qs.set("before", String(pageParam));
      return apiFetch(`/api/activity?${qs}`);
    },
    getNextPageParam: (last) => (last.length >= PAGE ? last[last.length - 1].created_at : undefined),
    refetchInterval: (q) => ((q.state.data?.pages.length ?? 1) <= 1 ? 10_000 : false),
  });
}
