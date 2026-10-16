import { NextResponse } from "next/server";
import { apiHandler } from "@/lib/api-handler";
import { publisherFor, defaultProvider } from "@/providers/publishing/registry";

export const dynamic = "force-dynamic";

const SUPPORTED_PLATFORMS = ["facebook", "instagram", "youtube", "x", "linkedin", "tiktok"];

const EMPTY = {
  kpis: { totalFollowers: null, totalImpressions: null, totalEngagement: null, totalReach: null, connectedAccounts: 0 },
  impressionsTrend: [] as { date: string; impressions: number }[],
  impressionsByPlatform: [] as { platform: string; impressions: number }[],
  platformComparison: [] as { platform: string; followers: number; reach: number; engagement: number }[],
  engagementBreakdown: [] as { type: string; value: number }[],
  platformHealth: SUPPORTED_PLATFORMS.map((platform) => ({ platform, status: "not_connected" })),
  audienceDemographics: null,
};

export const GET = apiHandler(async () => {
  try {
    const publisher = publisherFor(defaultProvider());
    const accounts = await publisher.listAccounts();

    const connectedAccounts = accounts.length;
    const connectedPlatforms = [...new Set(accounts.map((a) => a.platform))];

    const platformHealth = SUPPORTED_PLATFORMS.map((platform) => ({
      platform,
      status: connectedPlatforms.includes(platform) ? "connected" : "not_connected",
    }));

    const response = {
      ...EMPTY,
      kpis: { ...EMPTY.kpis, connectedAccounts },
      platformHealth,
    };

    return NextResponse.json(response);
  } catch {
    return NextResponse.json(EMPTY);
  }
});
