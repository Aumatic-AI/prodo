import { BarChart3 } from "lucide-react";
import { ACCENT, SectionTitle, DashCard, DashEmptyState } from "@/components/dashboard/DashboardKit";
import { platformMeta, formatCount } from "../lib/platforms";
import type { DashboardData } from "../hooks/useDashboard";

export function PlatformComparison({ platforms }: { platforms: DashboardData["platformComparison"] }) {
  const sorted = [...platforms].sort((a, b) => b.followers - a.followers);
  const maxFollowers = Math.max(...sorted.map((p) => p.followers), 1);

  return (
    <DashCard>
      <SectionTitle icon={BarChart3} accent={ACCENT.purple} title="Platforms" trailing={<span className="text-xs text-muted">by followers</span>} />
      {!sorted.length ? (
        <DashEmptyState message="Connect an account to compare platforms here." />
      ) : (
        <div className="space-y-4">
          {sorted.map((p) => {
            const meta = platformMeta(p.platform);
            const Icon = meta?.icon;
            const pct = Math.round((p.followers / maxFollowers) * 100);
            return (
              <div key={p.platform} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-white" style={{ background: meta?.color || "var(--color-text-secondary)" }}>
                  {Icon ? <Icon className="w-4 h-4" /> : null}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-semibold text-text">{meta?.label || p.platform}</span>
                    <span className="font-bold text-text tabular-nums">{formatCount(p.followers)} followers</span>
                  </div>
                  <div className="h-2 rounded-full bg-page overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: meta?.color || ACCENT.purple.solid }} />
                  </div>
                </div>
                <div className="text-right text-[11px] text-muted shrink-0 w-20 leading-tight">
                  <p>{formatCount(p.reach)} reach</p>
                  <p>{formatCount(p.engagement)} eng.</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </DashCard>
  );
}
