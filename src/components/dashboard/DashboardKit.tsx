import React from "react";
import { type LucideIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";

export const ACCENT = {
  purple: { solid: "#7C3AED", tint: "rgba(124,58,237,0.12)" },
  blue: { solid: "var(--color-primary)", tint: "var(--color-primary-subtle)" },
  green: { solid: "var(--color-success)", tint: "var(--color-success-bg)" },
  amber: { solid: "var(--color-warning)", tint: "var(--color-warning-bg)" },
  red: { solid: "var(--color-danger)", tint: "var(--color-danger-bg)" },
};

export const CHART_SERIES = [ACCENT.blue.solid, ACCENT.purple.solid, ACCENT.green.solid, ACCENT.amber.solid, ACCENT.red.solid];

export const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  background: "var(--color-surface)",
  border: "1px solid var(--color-border)",
  borderRadius: 10,
  fontSize: 12,
};

export function chartTickInterval(pointCount: number, targetLabels = 7): number {
  return Math.max(0, Math.ceil(pointCount / targetLabels) - 1);
}

export function DashCard({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`bg-surface border border-default rounded-xl shadow-xs p-5 ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, accent = ACCENT.blue, trailing }: { icon: LucideIcon; title: string; accent?: { solid: string; tint: string }; trailing?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: accent.tint, color: accent.solid }}>
          <Icon className="w-4 h-4" />
        </div>
        <h3 className="text-[15px] font-bold text-text">{title}</h3>
      </div>
      {trailing}
    </div>
  );
}

export function KpiTile({
  icon: Icon,
  accent,
  value,
  label,
  sublabel,
}: {
  icon: LucideIcon;
  accent: { solid: string; tint: string };
  value: React.ReactNode;
  label: string;
  sublabel?: string;
}) {
  return (
    <DashCard>
      <div className="flex items-center gap-2 mb-3">
        <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0" style={{ background: accent.tint, color: accent.solid }}>
          <Icon className="w-3.5 h-3.5" />
        </div>
        <p className="text-xs font-semibold text-muted uppercase tracking-wide">{label}</p>
      </div>
      <p className="text-3xl font-bold text-text tabular-nums leading-none">{value}</p>
      {sublabel && <p className="text-xs text-muted mt-2">{sublabel}</p>}
    </DashCard>
  );
}

export function DashEmptyState({ message }: { message: string }) {
  return <div className="text-center py-16 text-muted border border-default rounded-xl border-dashed text-sm">{message}</div>;
}

export function KpiRowSkeleton({ count, cols }: { count: number; cols: string }) {
  return (
    <div className={`grid ${cols} gap-4`}>
      {Array.from({ length: count }).map((_, i) => (
        <DashCard key={i}>
          <div className="flex items-center gap-2 mb-3">
            <Skeleton className="w-6 h-6 rounded-md shrink-0" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-8 w-20 rounded" />
        </DashCard>
      ))}
    </div>
  );
}

export function SectionTitleSkeleton({ titleWidth = "w-32", trailing = false }: { titleWidth?: string; trailing?: boolean }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
        <Skeleton className={`h-4 ${titleWidth} rounded`} />
      </div>
      {trailing && <Skeleton className="h-3 w-20 rounded" />}
    </div>
  );
}

export function AreaChartSkeleton({ height = 200 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

export function PieChartSkeleton({ legendRows = 4 }: { legendRows?: number }) {
  return (
    <div className="flex items-center gap-6">
      <Skeleton className="w-32 h-32 rounded-full shrink-0" />
      <div className="space-y-2.5 flex-1 min-w-0">
        {Array.from({ length: legendRows }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <Skeleton className="w-2 h-2 rounded-full shrink-0" />
              <Skeleton className="h-3 w-16 rounded" />
            </div>
            <Skeleton className="h-3 w-8 rounded shrink-0" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ProportionalListSkeleton({ rows = 4 }: { rows?: number }) {
  const BAR_WIDTHS = ["w-4/5", "w-3/5", "w-full", "w-2/5"];
  return (
    <div className="space-y-4">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center gap-3">
          <Skeleton className="w-8 h-8 rounded-lg shrink-0" />
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3 w-20 rounded" />
              <Skeleton className="h-3 w-14 rounded" />
            </div>
            <Skeleton className={`h-2 ${BAR_WIDTHS[i % BAR_WIDTHS.length]} rounded-full`} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function IconGridSkeleton({ items = 6 }: { items?: number }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex flex-col items-center gap-2">
          <Skeleton className="w-9 h-9 rounded-lg" />
          <Skeleton className="h-3 w-14 rounded" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
      ))}
    </div>
  );
}
