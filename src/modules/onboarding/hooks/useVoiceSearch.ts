"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { VoicePage } from "@/providers/ai/registry";

export interface VoiceFilterState {
  search: string;
  language: string;
  accent: string;
  gender: string;
  age: string;
  category: string;
  useCases: string[];
  featured: boolean;
  sort: string;
}

const PAGE_SIZE = 24;

function query(filters: VoiceFilterState, page: number): string {
  const qs = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE), sort: filters.sort });
  const optional = { search: filters.search.trim(), language: filters.language, accent: filters.accent, gender: filters.gender, age: filters.age, category: filters.category };
  for (const [key, value] of Object.entries(optional)) if (value) qs.set(key, value);
  filters.useCases.forEach((u) => qs.append("use_cases", u));
  if (filters.featured) qs.set("featured", "true");
  return qs.toString();
}

/** ElevenLabs voice library, one page at a time. Call fetchNextPage to load more. */
export function useVoiceSearch(filters: VoiceFilterState, enabled: boolean) {
  return useInfiniteQuery({
    queryKey: ["voices", filters],
    queryFn: ({ pageParam }) => apiFetch<VoicePage>(`/api/elevenlabs/voices?${query(filters, pageParam)}`),
    initialPageParam: 0,
    getNextPageParam: (last, pages) => (last.hasMore ? pages.length : undefined),
    staleTime: 10 * 60_000,
    enabled,
  });
}
