"use client";

import { useState } from "react";
import { Card } from "@/components/kit/Card";
import type { PerformanceView } from "@/core/performance/dashboard";
import { TimeChart } from "../charts/TimeChart";
import { Segmented } from "../shared/Segmented";

type Metric = "reach" | "engagements" | "posts";

const LABELS: Record<Metric, string> = { reach: "Reach", engagements: "Engagements", posts: "Posts" };

/** One measure over the period (never two scales on one chart: pick the measure instead). */
export function TrendCard({ data }: { data: PerformanceView }) {
  const [metric, setMetric] = useState<Metric>("reach");
  const points = data.daily.map((d) => ({ date: d.date, value: d[metric] }));
  return (
    <Card
      title={`${LABELS[metric]} by day`}
      description="By the day each post went out, with its latest numbers."
      actions={<Segmented label="Measure" value={metric} onChange={setMetric} options={(Object.keys(LABELS) as Metric[]).map((m) => ({ value: m, label: LABELS[m] }))} />}
    >
      <TimeChart data={points} kind={metric === "posts" ? "column" : "area"} />
    </Card>
  );
}
