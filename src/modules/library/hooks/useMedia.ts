"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Media, MediaType } from "@/core/media";

export function useMedia(type?: MediaType) {
  const params = type ? `?type=${type}` : "";
  return useQuery<Media[]>({
    queryKey: ["media", type],
    queryFn: () => apiFetch(`/api/media${params}`),
    refetchInterval: (query) => {
      const data = query.state.data;
      const hasGenerating = data?.some((m) => m.status === "generating");
      return hasGenerating ? 5000 : false;
    },
  });
}

export function useGenerateMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: {
      type: MediaType;
      idea?: string;
      content?: string;
      aspect_ratio?: string;
      use_logo?: boolean;
      duration_sec?: number;
      voice_id?: string;
      voice_name?: string;
      audio_style?: string;
      character?: string;
      video_type?: string;
      language?: string;
      product?: string;
      reference_image_key?: string;
    }) => apiFetch("/api/media", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useUploadReferenceImage() {
  return useMutation({
    mutationFn: async (file: File) => {
      const fd = new FormData();
      fd.set("file", file);
      return apiFetch<{ key: string; url: string }>("/api/media/reference", {
        method: "POST",
        body: fd,
      });
    },
  });
}

export function useImproveIdea() {
  return useMutation({
    mutationFn: (input: { idea: string; format: MediaType }) =>
      apiFetch<{ ideas: string[] }>("/api/media/improve-idea", {
        method: "POST",
        body: JSON.stringify(input),
      }),
  });
}

export function useRetryMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/media/${id}/retry`, { method: "POST" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useDeleteMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/media/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}
