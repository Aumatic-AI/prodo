"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { ContentSettingsView } from "@/core/content/settings";
import type { ContentSettings } from "@/core/onboarding/schemas";

const KEY = ["settings", "content"];

export function useContentSettings() {
  return useQuery({ queryKey: KEY, queryFn: () => apiFetch<ContentSettingsView>("/api/settings/content") });
}

export function useSaveContentSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (values: ContentSettings) => apiFetch<ContentSettingsView>("/api/settings/content", { method: "PUT", body: JSON.stringify(values) }),
    onSuccess: (saved) => {
      queryClient.setQueryData(KEY, saved);
      // Images only turns off video-only platforms in Automation
      void queryClient.invalidateQueries({ queryKey: ["settings", "automation"] });
    },
  });
}
