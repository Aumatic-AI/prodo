import { Activity, BadgeCheck, CalendarRange, Clapperboard, Loader2, PenTool, Send, TriangleAlert, type LucideIcon } from "lucide-react";
import { Card } from "@/components/kit/Card";
import { Skeleton } from "@/components/kit/Skeleton";
import { cn } from "@/lib/utils";
import type { ActivityRow } from "../hooks/usePlan";
import { AGENT_NAMES } from "../lib/status";
import { timeAgo } from "../lib/time";

const AGENT_ICON: Record<string, LucideIcon> = {
  planner: CalendarRange,
  creative_director: PenTool,
  producer: Clapperboard,
  qa_critic: BadgeCheck,
  publisher: Send,
};

export function ActivityList({ rows, compact = false }: { rows: ActivityRow[]; compact?: boolean }) {
  return (
    <ol className="m-0 flex list-none flex-col p-0">
      {rows.map((r, i) => {
        const Icon = r.status === "running" ? Loader2 : r.status === "failed" ? TriangleAlert : (AGENT_ICON[r.agent] ?? Activity);
        return (
          <li key={r.id} className="relative flex gap-3 pb-3.5">
            {i < rows.length - 1 && <span className="absolute left-[15px] top-8 h-[calc(100%-26px)] w-px bg-ob-line" aria-hidden="true" />}
            <span
              className={cn(
                "z-10 grid size-[30px] shrink-0 place-items-center rounded-full ring-4 ring-ob-surface",
                r.status === "failed" ? "bg-ob-danger-soft text-ob-danger" : r.status === "running" ? "bg-ob-primary text-ob-on-primary" : "bg-ob-sunken text-ob-ink-soft"
              )}
            >
              <Icon size={14} className={r.status === "running" ? "animate-spin" : undefined} />
            </span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5 pt-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-[12px] font-bold text-ob-ink">{AGENT_NAMES[r.agent] ?? r.agent}</span>
                <span className="shrink-0 text-[11px] text-ob-faint">{timeAgo(r.created_at)}</span>
              </div>
              <p className={cn("m-0 text-[12.5px] leading-snug", r.status === "failed" ? "text-ob-danger" : "text-ob-muted", compact && "line-clamp-2")}>
                {r.status === "failed" ? (r.error ?? "Failed") : (r.summary ?? (r.status === "running" ? "Working…" : "Done"))}
              </p>
              {Number(r.cost_usd) > 0 && <span className="text-[11px] tabular-nums text-ob-faint">${Number(r.cost_usd).toFixed(3)}</span>}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

/** What the agents did on this plan, newest first. Live while they work. */
export function ActivityFeed({ rows, loading }: { rows: ActivityRow[] | undefined; loading: boolean }) {
  return (
    <Card title="Agent activity" description="Every step, what it did and what it cost.">
      {loading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-12" />
          ))}
        </div>
      ) : rows?.length ? (
        <div className="max-h-[520px] overflow-y-auto pr-1">
          <ActivityList rows={rows.slice(0, 40)} compact />
        </div>
      ) : (
        <p className="m-0 text-sm text-ob-muted">Nothing yet. The agents log every step here.</p>
      )}
    </Card>
  );
}
