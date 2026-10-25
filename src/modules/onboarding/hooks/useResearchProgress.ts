"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ResearchProgress } from "@/core/onboarding/progress";

const KEY = ["onboarding", "progress"];
const POLL_MS = 3000;

/** Live research progress. Polls while the research runs; stops once it's done or failed. */
export function useResearchProgress() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<ResearchProgress>("/api/onboarding/progress"),
    refetchInterval: (query) => (query.state.data?.research?.state === "running" ? POLL_MS : false),
    refetchOnWindowFocus: "always",
  });
}

/** Runs the unfinished agents again and shows the new state straight away. */
export function useRetryResearch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<ResearchProgress>("/api/onboarding/retry", { method: "POST" }),
    onSuccess: (progress) => queryClient.setQueryData(KEY, progress),
  });
}
