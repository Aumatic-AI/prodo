"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import { BUSINESS_CHANNEL } from "@/lib/active-business";
import type { AccountView } from "@/core/accounts";

/** The login's businesses (the same on every device), loaded when the account menu opens. */
export function useAccounts(enabled: boolean) {
  return useQuery<AccountView[]>({ queryKey: ["account", "list"], queryFn: () => apiFetch("/api/account"), enabled, staleTime: 30_000 });
}

/**
 * Opens a business in this tab: the server picks it for this device, other open tabs reload into it, and this
 * tab reloads fully, so nothing from the last business stays on screen. One still setting up opens its onboarding.
 */
export async function openBusiness(businessId: string, path?: string): Promise<void> {
  const res = await apiFetch<{ status: AccountView["status"] }>("/api/account/switch", { method: "POST", body: JSON.stringify({ businessId }) });
  tellOtherTabs(businessId);
  window.location.assign(path ?? (res.status === "ready" ? "/week" : "/onboarding"));
}

/** "Add account" → a new business: opened here, straight into its onboarding. */
export async function startNewBusiness(): Promise<void> {
  const res = await apiFetch<{ businessId: string }>("/api/account/new", { method: "POST" });
  tellOtherTabs(res.businessId);
  window.location.assign("/onboarding");
}

function tellOtherTabs(businessId: string): void {
  if (typeof BroadcastChannel === "undefined") return;
  const channel = new BroadcastChannel(BUSINESS_CHANNEL);
  channel.postMessage({ businessId });
  channel.close();
}
