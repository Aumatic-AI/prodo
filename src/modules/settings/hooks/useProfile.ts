"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BusinessProfile } from "@/core/profile";

/** The business profile row, read only (Create content uses the voice, language and logo). */
export function useProfile() {
  return useQuery<BusinessProfile | null>({
    queryKey: ["profile"],
    queryFn: () => apiFetch("/api/profile"),
  });
}
