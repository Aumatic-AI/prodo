"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { Media, MediaType } from "@/core/media";
import type { MediaDetail, MediaListItem } from "../types";

/** Every media item, newest first. Polls while something is still being made. */
export function useMedia() {
  return useQuery<MediaListItem[]>({
    queryKey: ["media"],
    queryFn: () => apiFetch("/api/media"),
    refetchInterval: (query) => (query.state.data?.some((m) => m.status === "generating") ? 5000 : false),
  });
}

/** One item with its files (carousel slides, renditions). */
export function useMediaItem(id: string | null) {
  return useQuery<MediaDetail>({
    queryKey: ["media-item", id],
    queryFn: () => apiFetch(`/api/media/${id}`),
    enabled: !!id,
  });
}

export interface GenerateMediaInput {
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
  language?: string;
  offering_id?: string;
  product_name?: string;
  reference_image_key?: string;
}

export function useGenerateMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: GenerateMediaInput) => apiFetch<Media>("/api/media", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

/** Saves files already uploaded to storage as ready media items. */
export function useSaveUploads() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { keys: string[]; idea?: string; offering_id?: string }) => {
      for (const key of input.keys) {
        await apiFetch("/api/media", {
          method: "POST",
          body: JSON.stringify({ source: "uploaded", storage_key: key, idea: input.idea, offering_id: input.offering_id }),
        });
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}

export function useImproveIdea() {
  return useMutation({
    mutationFn: (input: { idea: string; format: MediaType }) =>
      apiFetch<{ ideas: string[] }>("/api/media/improve-idea", { method: "POST", body: JSON.stringify(input) }),
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

/** "Make again with a note": a new item with the same inputs plus the change. */
export function useRedoMedia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => apiFetch(`/api/media/${id}/redo`, { method: "POST", body: JSON.stringify({ note }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["media"] }),
  });
}
