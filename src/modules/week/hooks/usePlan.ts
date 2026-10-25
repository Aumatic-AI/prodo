"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { WeekClock } from "@/core/plans/week";
import { WORKING, type PlanItemView, type PlanView } from "@/core/plans/types";

export interface WeekData {
  weekStart: string;
  clock: WeekClock;
  plan: PlanView | null;
}

export interface ActivityRow {
  id: string;
  agent: string;
  status: "running" | "done" | "failed";
  summary: string | null;
  error: string | null;
  cost_usd: number;
  duration_ms: number | null;
  plan_id: string | null;
  plan_item_id: string | null;
  media_id: string | null;
  created_at: string;
}

/** True while the agents are still planning or making something in this plan. */
export function isBusy(plan: PlanView | null | undefined): boolean {
  if (!plan) return false;
  return plan.status === "planning" || plan.status === "producing" || plan.items.some((i) => WORKING.includes(i.status));
}

/** A week's plan. Polls every 4 s while the agents work (or while a plan was just requested). */
export function usePlan(week: string, waitingForPlan = false) {
  return useQuery<WeekData>({
    queryKey: ["plan", week],
    queryFn: () => apiFetch(`/api/plans?week=${week}`),
    refetchInterval: (q) => (isBusy(q.state.data?.plan) || (waitingForPlan && !q.state.data?.plan) ? 4000 : false),
  });
}

export function useActivity(params: { planId?: string | null; itemId?: string | null }, live: boolean) {
  const qs = new URLSearchParams();
  if (params.planId) qs.set("planId", params.planId);
  if (params.itemId) qs.set("itemId", params.itemId);
  return useQuery<ActivityRow[]>({
    queryKey: ["activity", params.planId ?? null, params.itemId ?? null],
    queryFn: () => apiFetch(`/api/activity?${qs}`),
    enabled: !!(params.planId || params.itemId),
    refetchInterval: live ? 4000 : false,
  });
}

function useRefresh() {
  const qc = useQueryClient();
  return () => {
    qc.invalidateQueries({ queryKey: ["plan"] });
    qc.invalidateQueries({ queryKey: ["activity"] });
    qc.invalidateQueries({ queryKey: ["calendar"] });
    qc.invalidateQueries({ queryKey: ["notifications"] });
  };
}

export function useRequestPlan() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: { week: string; replace?: boolean }) =>
      apiFetch<{ weekStart: string }>("/api/plans/request", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: refresh,
  });
}

export function useApprovePlan() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (planId: string) => apiFetch<{ approved: number }>(`/api/plans/${planId}/approve`, { method: "POST" }),
    onSuccess: refresh,
  });
}

type ItemAction = "approve" | "reject" | "regenerate" | "schedule";

export function useItemAction() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, action, note }: { id: string; action: ItemAction; note?: string | null }) =>
      apiFetch<PlanItemView>(`/api/plan-items/${id}/${action}`, { method: "POST", body: JSON.stringify({ note: note ?? null }) }),
    onSuccess: refresh,
  });
}

export function useSaveCaptions() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: ({ id, captions }: { id: string; captions: Record<string, string> }) =>
      apiFetch<PlanItemView>(`/api/plan-items/${id}`, { method: "PATCH", body: JSON.stringify({ captions }) }),
    onSuccess: refresh,
  });
}

export interface CreateAdInput {
  format: "static" | "carousel" | "video" | "text";
  platforms: string[];
  idea: string;
  offeringId?: string | null;
  personaId?: string | null;
  slotAt?: string | null;
}

export function useCreateAd() {
  const refresh = useRefresh();
  return useMutation({
    mutationFn: (input: CreateAdInput) => apiFetch<PlanItemView>("/api/ads", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: refresh,
  });
}
