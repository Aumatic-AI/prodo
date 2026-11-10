"use client";

import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { LibraryResult, LibraryStart } from "@/core/ad-library";

export interface LibrarySearch {
  /** A brand name or words in the ads */
  query: string;
  /** ISO code or "ALL" */
  country: string;
}

/** The business's country and the searches left today. No vendor call. */
export function useAdLibraryStart(enabled: boolean) {
  return useQuery<LibraryStart>({ queryKey: ["ad-library", "start"], queryFn: () => apiFetch("/api/ad-library"), enabled });
}

/**
 * The pages of one search. Each page can cost a credit, so nothing is fetched on its own: only the first page
 * when Search is pressed, and the next one on "Show more". Pages stay in memory while the app is open, and the
 * server keeps them 48 hours.
 */
export function useAdLibrarySearch(search: LibrarySearch | null) {
  return useInfiniteQuery<LibraryResult>({
    queryKey: ["ad-library", search?.query.trim().toLowerCase(), search?.country],
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({ q: search!.query.trim(), country: search!.country, page: String(pageParam) });
      return apiFetch(`/api/ad-library?${params}`);
    },
    initialPageParam: 1,
    getNextPageParam: (last) => (last.hasMore ? last.page + 1 : undefined),
    enabled: !!search,
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: false,
  });
}
