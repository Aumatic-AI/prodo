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

export function useDeletePost() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/posts/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["posts"] }),
  });
}
