"use client";

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/api-client";

export interface DashboardData {
  kpis: {
    totalFollowers: number | null;
    totalImpressions: number | null;
    totalEngagement: number | null;
    totalReach: number | null;
    connectedAccounts: number;
  };
  impressionsTrend: { date: string; impressions: number }[];
  impressionsByPlatform: { platform: string; impressions: number }[];
  platformComparison: { platform: string; followers: number; reach: number; engagement: number }[];
  engagementBreakdown: { type: string; value: number }[];
  platformHealth: { platform: string; status: string }[];
  audienceDemographics: { age: Record<string, number>; gender: Record<string, number> } | null;
}

export function useDashboard() {
  return useQuery<DashboardData>({
    queryKey: ["dashboard"],
    queryFn: () => apiFetch("/api/dashboard"),
    staleTime: 0,
    gcTime: 0,
    refetchOnWindowFocus: false,
  });
}
