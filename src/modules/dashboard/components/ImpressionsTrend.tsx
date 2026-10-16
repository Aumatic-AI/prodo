"use client";

import { TrendingUp } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { ACCENT, CHART_TOOLTIP_STYLE, SectionTitle, DashCard, DashEmptyState, chartTickInterval } from "@/components/dashboard/DashboardKit";
import type { DashboardData } from "../hooks/useDashboard";

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ImpressionsTrend({ data }: { data: DashboardData["impressionsTrend"] }) {
  const hasData = data.some((d) => d.impressions > 0);
  const tickInterval = chartTickInterval(data.length);

  return (
    <DashCard>
      <SectionTitle icon={TrendingUp} accent={ACCENT.blue} title="Impressions" />
      {!hasData ? (
        <DashEmptyState message="No impressions yet — connect an account and publish to start seeing data here." />
      ) : (
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 0, right: 8, top: 8, bottom: 0 }}>
              <defs>
                <linearGradient id="impressionsFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ACCENT.blue.solid} stopOpacity={0.25} />
                  <stop offset="100%" stopColor={ACCENT.blue.solid} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tickFormatter={formatShortDate} tick={{ fontSize: 11, fill: "var(--color-text-muted)" }} axisLine={false} tickLine={false} interval={tickInterval} />
              <YAxis hide domain={[0, (max: number) => Math.ceil(max * 1.15) || 10]} />
              <Tooltip
                contentStyle={CHART_TOOLTIP_STYLE}
                cursor={{ stroke: "var(--color-border)", strokeWidth: 1 }}
                labelFormatter={(v) => formatShortDate(v as string)}
                formatter={(value: any) => [Number(value).toLocaleString(), "Impressions"]}
              />
              <Area type="monotone" dataKey="impressions" stroke={ACCENT.blue.solid} strokeWidth={2} fill="url(#impressionsFill)" activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </DashCard>
  );
}
