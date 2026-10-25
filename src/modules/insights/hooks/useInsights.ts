"use client";

import { useInfiniteQuery, useMutation, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PerformanceView } from "@/core/performance/dashboard";
import type { CostsView } from "@/core/performance/costs";
import type { ActivityRow } from "@/modules/week/hooks/usePlan";

export function usePerformance(days: number) {
  return useQuery<PerformanceView>({ queryKey: ["performance", days], queryFn: () => apiFetch(`/api/performance?days=${days}`) });
}

export function useLearnNow() {
  return useMutation({ mutationFn: () => apiFetch<{ started: boolean }>("/api/performance/learn", { method: "POST" }) });
}

export function useCosts(month: string) {
  return useQuery<CostsView>({ queryKey: ["costs", month], queryFn: () => apiFetch(`/api/costs?month=${month}`) });
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
