"use client";

import { useState } from "react";
import { LineChart, Loader2, RefreshCw } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { EmptyState } from "@/components/kit/EmptyState";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { useLearnNow, usePerformance } from "../hooks/useInsights";
import { AudienceCard } from "../components/performance/AudienceCard";
import { KpiRow } from "../components/performance/KpiRow";
import { LearningsCard } from "../components/performance/LearningsCard";
import { PlatformsCard } from "../components/performance/PlatformsCard";
import { ReportCard } from "../components/performance/ReportCard";
import { TopPosts } from "../components/performance/TopPosts";
import { TrendCard } from "../components/performance/TrendCard";
import { Segmented } from "../components/shared/Segmented";

const RANGES = [
  { value: 7, label: "7 days" },
  { value: 30, label: "30 days" },
  { value: 90, label: "90 days" },
];

/** How posts perform and what the Performance Analyst learned from them. */
export function PerformancePage() {
  const [days, setDays] = useState(30);
  const { data, isLoading, error } = usePerformance(days);
  const learn = useLearnNow();

  return (
    <div className="mx-auto flex max-w-[1320px] flex-col gap-6">
      <PageHeader
        eyebrow="Insights"
        title="Performance"
        description="How your posts do, and what Prodo learns from them for next week's plan."
        actions={
          <>
            <Segmented label="Period" value={days} onChange={setDays} options={RANGES} />
            <button type="button" className={button({ variant: "secondary", size: "sm" })} disabled={learn.isPending || learn.isSuccess} onClick={() => learn.mutate()}>
              {learn.isPending ? <Loader2 size={15} className="animate-spin" /> : <RefreshCw size={15} />}
              Update learnings
            </button>
          </>
        }
      />

      {learn.isSuccess && <Alert tone="success">The Performance Analyst is updating your learnings. It takes a minute or two; refresh this page to see them.</Alert>}
      {learn.error && <Alert tone="error">{learn.error.message}</Alert>}
      {error && <Alert tone="error">{error.message}</Alert>}

      {isLoading || !data ? (
        <div className="flex flex-col gap-4">
          <Skeleton className="h-36" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {Array.from({ length: 5 }, (_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
          <Skeleton className="h-72" />
        </div>
      ) : !data.hasData ? (
        <EmptyState
          icon={LineChart}
          title="No numbers yet"
          description="Results arrive every morning once your posts are live, and follower counts are taken daily. The first learnings come after about a week of posting, and the Planner uses them from then on."
        />
      ) : (
        <>
          {data.report && <ReportCard report={data.report} />}
          <KpiRow data={data} />
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <TrendCard data={data} />
            <AudienceCard data={data} />
          </div>
          <LearningsCard learnings={data.learnings} />
          <div className="grid grid-cols-1 items-start gap-5 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <TopPosts posts={data.topPosts} />
            <PlatformsCard data={data} />
          </div>
        </>
      )}
    </div>
  );
}
