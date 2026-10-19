"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { PostWithTargets } from "@/core/posts";

export function usePost(id: string) {
  return useQuery<PostWithTargets>({
    queryKey: ["posts", id],
    queryFn: () => apiFetch(`/api/posts/${id}`),
    enabled: !!id,
  });
}

export function usePosts() {
  return useQuery<PostWithTargets[]>({
    queryKey: ["posts"],
    queryFn: () => apiFetch("/api/posts"),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasActive = data?.some((p) => ["publishing", "scheduled"].includes(p.status));
      return hasActive ? 5000 : false;
    },
  });
}

export function useCreatePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      media_id: string;
      action: "now" | "schedule" | "draft";
      publish_at?: string | null;
      targets: {
        platform: string;
        account_id: string;
        account_name: string;
        caption: string;
        provider: string;
      }[];
    }) => apiFetch("/api/posts", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function usePublishDraft() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      id: string;
      action: "now" | "schedule" | "draft";
      publish_at?: string | null;
      targets?: {
        platform: string;
        account_id: string;
        account_name: string;
        caption: string;
        provider: string;
      }[];
    }) =>
      apiFetch(`/api/posts/${input.id}/publish`, {
        method: "POST",
        body: JSON.stringify({ action: input.action, publish_at: input.publish_at, targets: input.targets }),
      }),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["posts", variables.id] });
    },
  });
}

export function useCancelPost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/posts/${id}/cancel`, { method: "POST" }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ["posts"] });
      qc.invalidateQueries({ queryKey: ["posts", id] });
    },
  });
}

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}

export function useGenerateCaptions() {
  return useMutation({
    mutationFn: (input: { mediaId: string; platforms: string[] }) =>
      apiFetch<{ captions: Record<string, string> }>(`/api/media/${input.mediaId}/captions`, {
        method: "POST",
        body: JSON.stringify({ platforms: input.platforms }),
      }),
  });
}

export function useImproveCaption() {
  return useMutation({
    mutationFn: (input: { platform: string; caption: string; instruction?: string }) =>
      apiFetch<{ caption: string }>("/api/captions/improve", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}
