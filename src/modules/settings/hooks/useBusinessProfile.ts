"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BasicsDraft } from "@/core/onboarding/schemas";

const KEY = ["settings", "profile"];

export function useBusinessProfile() {
  return useQuery({ queryKey: KEY, queryFn: () => apiFetch<BasicsDraft>("/api/settings/profile") });
}

export function useSaveBusinessProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (basics: BasicsDraft) => apiFetch<BasicsDraft>("/api/settings/profile", { method: "PUT", body: JSON.stringify(basics) }),
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved);
      void queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
