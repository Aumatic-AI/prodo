"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Offering } from "@/core/offerings";

/** Active offerings, for Create Content's product picker. They're edited in Brand → Offerings. */
export function useOfferings() {
  return useQuery<Offering[]>({
    queryKey: ["offerings"],
    queryFn: () => apiFetch("/api/offerings"),
  });
}
