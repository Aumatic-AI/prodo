"use client";

import { keepPreviousData, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";
import type { CalendarEvent, CalendarResponse, EventKind } from "../lib/types";

export function useCalendar(from: string, to: string) {
  return useQuery<CalendarResponse>({
    queryKey: ["calendar", from, to],
    queryFn: () => apiFetch(`/api/calendar?from=${from}&to=${to}`),
    placeholderData: keepPreviousData,
  });
}

export interface NewEvent {
  date: string;
  name: string;
  kind: EventKind;
  notes?: string | null;
}

export function useAddEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: NewEvent) => apiFetch<CalendarEvent>("/api/calendar/events", { method: "POST", body: JSON.stringify(input) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}

export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiFetch(`/api/calendar/events/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["calendar"] }),
  });
}
