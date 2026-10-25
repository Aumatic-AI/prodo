"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { Notification } from "@/core/notifications/notify";
import { apiFetch } from "@/lib/api-client";

const KEY = ["notifications"];

export interface NotificationList {
  items: Notification[];
  unread: number;
}

/** Notifications and the unread count. Polls every 30 s (the sidebar shows the count). */
export function useNotifications() {
  return useQuery<NotificationList>({ queryKey: KEY, queryFn: () => apiFetch("/api/notifications"), refetchInterval: 30_000 });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (ids: string[] | "all") => apiFetch<NotificationList>("/api/notifications/read", { method: "POST", body: JSON.stringify({ ids }) }),
    onSuccess: (next) => qc.setQueryData(KEY, next),
  });
}
