import Link from "next/link";
import { Activity, ArrowUpRight, BadgeCheck, BookOpen, CalendarRange, Clapperboard, Globe, LineChart, Loader2, Palette, PenTool, Send, Share2, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { AGENT_NAMES } from "@/modules/week/lib/status";
import type { ActivityItem } from "../../hooks/useInsights";
import { duration, usd } from "../../lib/format";

export const AGENT_ICON: Record<string, LucideIcon> = {
  website_analyst: Globe,
  visual_identity_analyst: Palette,
  social_market_analyst: Share2,
  brand_strategist: BookOpen,
  planner: CalendarRange,
  creative_director: PenTool,
  producer: Clapperboard,
  qa_critic: BadgeCheck,
  publisher: Send,
  performance_analyst: LineChart,
};

const time = (iso: string) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

/** One agent step: who, what it did (or why it failed), cost, time taken, and its post when there is one. */
export function ActivityRowItem({ row }: { row: ActivityItem }) {
  const failed = row.status === "failed";
  const running = row.status === "running";
  const Icon = running ? Loader2 : failed ? TriangleAlert : (AGENT_ICON[row.agent] ?? Activity);
  const cost = Number(row.cost_usd ?? 0);
  return (
    <li className="group flex gap-3 rounded-ob-md px-2 py-2.5 transition-colors hover:bg-ob-sunken sm:px-3">
      <span
        className={cn(
          "grid size-9 shrink-0 place-items-center rounded-full",
          failed ? "bg-ob-danger-soft text-ob-danger" : running ? "bg-ob-primary text-ob-on-primary" : "bg-ob-primary-soft text-ob-primary"
        )}
      >
        <Icon size={16} className={running ? "animate-spin" : undefined} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <span className="text-[13px] font-bold text-ob-ink">{AGENT_NAMES[row.agent] ?? row.agent}</span>
          <span className="text-[11.5px] tabular-nums text-ob-faint">{time(row.created_at)}</span>
        </div>
        <p className={cn("m-0 text-[13px] leading-snug", failed ? "text-ob-danger" : "text-ob-muted")}>
          {failed ? (row.error ?? "Failed") : (row.summary ?? (running ? "Working…" : "Done"))}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-ob-faint">
          {cost > 0 && <span className="tabular-nums">{usd(cost, 3)}</span>}
          {row.duration_ms ? <span className="tabular-nums">{duration(row.duration_ms)}</span> : null}
          {row.plan_item_id && (
            <Link href={`/week?item=${row.plan_item_id}`} className="inline-flex items-center gap-0.5 font-semibold text-ob-primary hover:underline">
              Open post <ArrowUpRight size={12} />
            </Link>
          )}
        </div>
      </div>
    </li>
  );
}
