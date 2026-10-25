"use client";

import { queryOptions, useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ConnectedAccount } from "@/providers/publishing/types";

/** Shared query, so prefetching and reading use the same cache entry. */
export const accountsQuery = queryOptions({
  queryKey: ["accounts"],
  queryFn: () => apiFetch<ConnectedAccount[]>("/api/accounts"),
  staleTime: 60_000,
});

export function useAccounts() {
  // Always refetch on tab focus: picks up an account just connected in the other tab
  return useQuery({ ...accountsQuery, refetchOnWindowFocus: "always" });
}

export async function openConnectLink(platform: string): Promise<void> {
  // Open the tab first so the browser doesn't block it as a popup
  const tab = window.open("", "_blank");
  try {
    const { url } = await apiFetch<{ url: string | null }>(`/api/accounts/connect?platform=${encodeURIComponent(platform)}`);
    if (url && tab) tab.location.href = url;
    else tab?.close();
  } catch (err) {
    tab?.close();
    throw err;
  }
}
