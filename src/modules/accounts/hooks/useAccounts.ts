"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

interface ConnectedAccount {
  id: string;
  platform: string;
  name: string;
  profileUrl?: string;
  avatarUrl?: string;
}

export function useAccounts() {
  return useQuery<ConnectedAccount[]>({
    queryKey: ["accounts"],
    queryFn: () => apiFetch("/api/accounts"),
    staleTime: 60_000,
  });
}
