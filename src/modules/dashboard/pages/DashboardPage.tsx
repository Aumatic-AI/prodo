"use client";

import { useDashboard } from "../hooks/useDashboard";
import { KpiRow } from "../components/KpiRow";
import { ImpressionsTrend } from "../components/ImpressionsTrend";
import { EngagementBreakdown } from "../components/EngagementBreakdown";
import { PlatformComparison } from "../components/PlatformComparison";
import { ImpressionsByPlatform } from "../components/ImpressionsByPlatform";
import { PlatformHealth } from "../components/PlatformHealth";
import { AudienceDemographics } from "../components/AudienceDemographics";
import {
  DashCard,
  KpiRowSkeleton,
  SectionTitleSkeleton,
  AreaChartSkeleton,
  PieChartSkeleton,
  ProportionalListSkeleton,
  IconGridSkeleton,
} from "@/components/dashboard/DashboardKit";

export function DashboardPage() {
  const { data, isLoading } = useDashboard();

  if (isLoading || !data) {
    return (
      <div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="mt-1 text-sm text-muted">Analytics across all your connected accounts.</p>
        </div>

        <div className="max-w-5xl mx-auto space-y-6">
          <KpiRowSkeleton count={5} cols="grid-cols-2 lg:grid-cols-5" />

          <div className="grid sm:grid-cols-1 md:grid-cols-[7fr_3fr] gap-5">
            <DashCard>
              <SectionTitleSkeleton titleWidth="w-28" />
              <AreaChartSkeleton height={220} />
            </DashCard>
            <DashCard>
              <SectionTitleSkeleton titleWidth="w-40" />
              <PieChartSkeleton legendRows={4} />
            </DashCard>
          </div>

          <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-5">
            <DashCard>
              <SectionTitleSkeleton titleWidth="w-20" trailing />
              <ProportionalListSkeleton rows={4} />
            </DashCard>
            <DashCard>
              <SectionTitleSkeleton titleWidth="w-44" />
              <ProportionalListSkeleton rows={4} />
            </DashCard>
          </div>

          <DashCard>
            <SectionTitleSkeleton titleWidth="w-32" />
            <IconGridSkeleton items={6} />
          </DashCard>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-text">Dashboard</h1>
        <p className="mt-1 text-sm text-muted">Analytics across all your connected accounts.</p>
      </div>

      <div className="max-w-5xl mx-auto space-y-6">
        <KpiRow kpis={data.kpis} />

        <div className="grid sm:grid-cols-1 md:grid-cols-[7fr_3fr] gap-5">
          <ImpressionsTrend data={data.impressionsTrend} />
          <EngagementBreakdown data={data.engagementBreakdown} />
        </div>

        <div className="grid sm:grid-cols-1 md:grid-cols-2 gap-5">
          <PlatformComparison platforms={data.platformComparison} />
          <ImpressionsByPlatform data={data.impressionsByPlatform} />
        </div>

        <PlatformHealth platforms={data.platformHealth} />

        {data.audienceDemographics && <AudienceDemographics demographics={data.audienceDemographics} />}
      </div>
    </div>
  );
}
