"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { AdminBusiness, AdminBusinessDetail } from "@/core/admin/businesses";
import type { AdminDashboard, TopupRow, UsageView } from "@/core/admin/overview";
import type { CreditPrice } from "@/core/credits/prices";

// The admin panel's data. Every change refreshes everything under "admin", so lists and totals stay right.

export function useAdminDashboard() {
  return useQuery<AdminDashboard>({ queryKey: ["admin", "dashboard"], queryFn: () => apiFetch("/api/admin/dashboard") });
}

export function useAdminBusinesses() {
  return useQuery<AdminBusiness[]>({ queryKey: ["admin", "businesses"], queryFn: () => apiFetch("/api/admin/businesses") });
}

export function useAdminBusiness(id: string) {
  return useQuery<AdminBusinessDetail>({ queryKey: ["admin", "business", id], queryFn: () => apiFetch(`/api/admin/businesses/${id}`) });
}

export function useAdminUsage(month: string) {
  return useQuery<UsageView>({ queryKey: ["admin", "usage", month], queryFn: () => apiFetch(`/api/admin/usage?month=${month}`) });
}

export function useAdminTopups(month: string) {
  return useQuery<{ month: string; rows: TopupRow[]; credits: number; revenue: number }>({
    queryKey: ["admin", "topups", month],
    queryFn: () => apiFetch(`/api/admin/topups?month=${month}`),
  });
}

export function useAdminPrices() {
  return useQuery<CreditPrice[]>({ queryKey: ["admin", "prices"], queryFn: () => apiFetch("/api/admin/prices") });
}

function useAdminMutation<I, O>(fn: (input: I) => Promise<O>) {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: fn, onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin"] }) });
}

export interface NewBusinessInput {
  email: string;
  password: string;
  credits: number;
  amountUsd: number | null;
  note: string | null;
}

export function useCreateBusiness() {
  return useAdminMutation((input: NewBusinessInput) => apiFetch<AdminBusiness>("/api/admin/businesses", { method: "POST", body: JSON.stringify(input) }));
}

export function useAddCredits(businessId: string) {
  return useAdminMutation((input: { credits: number; amountUsd: number | null; note: string | null }) =>
    apiFetch<{ balance: number }>(`/api/admin/businesses/${businessId}/credits`, { method: "POST", body: JSON.stringify(input) })
  );
}

export function useSetPassword(businessId: string) {
  return useAdminMutation((password: string) => apiFetch(`/api/admin/businesses/${businessId}/password`, { method: "POST", body: JSON.stringify({ password }) }));
}

export function useSetBudget(businessId: string) {
  return useAdminMutation((budgetUsd: number) => apiFetch(`/api/admin/businesses/${businessId}/settings`, { method: "PUT", body: JSON.stringify({ budgetUsd }) }));
}

export function useSavePrices() {
  return useAdminMutation((prices: { action: string; credits: number }[]) => apiFetch<CreditPrice[]>("/api/admin/prices", { method: "PUT", body: JSON.stringify({ prices }) }));
}
