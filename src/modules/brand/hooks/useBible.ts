"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BibleContent, BibleVersion } from "@/core/brand/bible";
import type { BibleOverview } from "@/core/brand/overview";
import type { PendingFact, PendingKind } from "@/core/brand/pending";
import type { ResolvedSource } from "@/core/brand/sources";

const BIBLE = ["brand", "bible"];
const PENDING = ["brand", "pending"];
const POLL_MS = 4000;

const writing = (o: BibleOverview | undefined) => o?.strategist?.state === "running" || o?.strategist?.state === "queued";

/** Approved Bible, draft and history. Polls while the Strategist is writing a draft. */
export function useBibleOverview() {
  return useQuery({
    queryKey: BIBLE,
    queryFn: () => apiFetch<BibleOverview>("/api/brand/bible"),
    refetchInterval: (query) => (writing(query.state.data) ? POLL_MS : false),
  });
}

export const isWriting = writing;

export function useBibleVersion(id: string | null) {
  return useQuery({
    queryKey: [...BIBLE, id],
    queryFn: () => apiFetch<BibleVersion>(`/api/brand/bible/${id}`),
    enabled: !!id,
    staleTime: Infinity,
  });
}

function useBibleMutation<T>(fn: (input: T) => Promise<BibleOverview>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: (overview) => queryClient.setQueryData(BIBLE, overview) });
}

/** Saves edits as a new draft version. */
export function useSaveBible() {
  return useBibleMutation((content: BibleContent) => apiFetch<BibleOverview>("/api/brand/bible", { method: "PUT", body: JSON.stringify(content) }));
}

export function useApproveBible() {
  return useBibleMutation((id: string) => apiFetch<BibleOverview>(`/api/brand/bible/${id}/approve`, { method: "POST" }));
}

export function useRegenerateBible() {
  return useBibleMutation((note: string) => apiFetch<BibleOverview>("/api/brand/bible/regenerate", { method: "POST", body: JSON.stringify({ note }) }));
}

/** The text behind a claim. Loaded only when "Show sources" is opened. */
export function useSources(refs: string[] | null) {
  return useQuery({
    queryKey: ["brand", "sources", refs],
    queryFn: () => apiFetch<ResolvedSource[]>(`/api/brand/sources?refs=${encodeURIComponent((refs ?? []).join(","))}`),
    enabled: !!refs?.length,
    staleTime: 5 * 60_000,
  });
}

export function usePendingFacts() {
  return useQuery({ queryKey: PENDING, queryFn: () => apiFetch<PendingFact[]>("/api/brand/pending") });
}

/** Confirm or reject facts found on the website. Refreshes the Bible too (the offer stack changes). */
export function useDecidePending() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { items: { kind: PendingKind; id: string }[]; accept: boolean }) =>
      apiFetch<PendingFact[]>("/api/brand/pending", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: (pending) => {
      queryClient.setQueryData(PENDING, pending);
      void queryClient.invalidateQueries({ queryKey: BIBLE });
      void queryClient.invalidateQueries({ queryKey: ["brand", "resource"] });
    },
  });
}
