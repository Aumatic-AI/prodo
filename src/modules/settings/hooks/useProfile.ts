"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BusinessProfile } from "@/core/profile";

export function useProfile() {
  return useQuery<BusinessProfile | null>({
    queryKey: ["profile"],
    queryFn: () => apiFetch("/api/profile"),
  });
}

export function useSaveProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (formData: FormData) => {
      const res = await fetch("/api/profile", { method: "PUT", body: formData });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error?.message || "Failed to save profile");
      }
      return res.json();
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["profile"] }),
  });
}
