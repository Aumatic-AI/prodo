"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { BrandKit, KitInput } from "@/core/brand/kit";
import type { ResourceKey, ResourceRow } from "@/core/brand/resources";

const keyOf = (resource: ResourceKey, archived = false) => ["brand", "resource", resource, archived];

/** One Brand Hub list. */
export function useResource(resource: ResourceKey, archived = false) {
  return useQuery({
    queryKey: keyOf(resource, archived),
    queryFn: () => apiFetch<ResourceRow[]>(`/api/brand/resources/${resource}${archived ? "?archived=1" : ""}`),
  });
}

/** Create, update, archive or delete; every change refreshes that list (archived and not). */
export function useResourceMutations(resource: ResourceKey) {
  const queryClient = useQueryClient();
  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ["brand", "resource", resource] });
    // Offerings feed Create Content's product picker
    if (resource === "offerings") void queryClient.invalidateQueries({ queryKey: ["offerings"] });
  };
  const base = `/api/brand/resources/${resource}`;
  return {
    create: useMutation({ mutationFn: (values: Record<string, unknown>) => apiFetch<ResourceRow>(base, { method: "POST", body: JSON.stringify(values) }), onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ id, values }: { id: string; values: Record<string, unknown> }) => apiFetch<ResourceRow>(`${base}/${id}`, { method: "PATCH", body: JSON.stringify(values) }),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: (id: string) => apiFetch(`${base}/${id}`, { method: "DELETE" }), onSuccess: refresh }),
  };
}

export function useKit() {
  return useQuery({ queryKey: ["brand", "kit"], queryFn: () => apiFetch<BrandKit>("/api/brand/kit") });
}

export function useSaveKit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (kit: KitInput) => apiFetch<BrandKit>("/api/brand/kit", { method: "PUT", body: JSON.stringify(kit) }),
    onSuccess: (kit) => queryClient.setQueryData(["brand", "kit"], kit),
  });
}
