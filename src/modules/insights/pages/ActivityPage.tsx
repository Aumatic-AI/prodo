"use client";

import { useMemo, useState } from "react";
import { Activity, Loader2, TriangleAlert } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { Card } from "@/components/kit/Card";
import { EmptyState } from "@/components/kit/EmptyState";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { cn } from "@/lib/utils";
import { AGENT_NAMES } from "@/modules/week/lib/status";
import { useActivityFeed, type ActivityItem } from "../hooks/useInsights";
import { ActivityRowItem, AGENT_ICON } from "../components/activity/ActivityRowItem";
import { usd } from "../lib/format";

const AGENTS = Object.keys(AGENT_ICON);

function dayTitle(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" }).format(d);
}

/** Everything every agent did, newest first: research, planning, making, checking, publishing, learning. */
export function ActivityPage() {
  const [agent, setAgent] = useState<string | null>(null);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const feed = useActivityFeed({ agent, problemsOnly });
  const rows = useMemo(() => feed.data?.pages.flat() ?? [], [feed.data]);

  const days = useMemo(() => {
    const groups: { title: string; rows: ActivityItem[]; cost: number }[] = [];
    for (const row of rows) {
      const title = dayTitle(row.created_at);
      let g = groups[groups.length - 1];
      if (!g || g.title !== title) groups.push((g = { title, rows: [], cost: 0 }));
      g.rows.push(row);
      g.cost += Number(row.cost_usd ?? 0);
    }
    return groups;
  }, [rows]);

  const pill = (active: boolean) =>
    cn(
      "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition-colors",
      active ? "border-ob-primary bg-ob-primary-soft text-ob-primary" : "border-ob-line bg-ob-surface text-ob-muted hover:border-ob-line-strong hover:text-ob-ink"
    );

  return (
    <div className="mx-auto flex max-w-[960px] flex-col gap-6">
      <PageHeader eyebrow="Insights" title="Activity" description="Every step the agents take: what they did, what it cost, and what went wrong. Updates live." />

      <div className="flex flex-col gap-3">
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0" role="group" aria-label="Filter by agent">
          <button type="button" className={pill(agent === null)} onClick={() => setAgent(null)}>
            All agents
          </button>
          {AGENTS.map((a) => {
            const Icon = AGENT_ICON[a];
            return (
              <button key={a} type="button" aria-pressed={agent === a} className={pill(agent === a)} onClick={() => setAgent(agent === a ? null : a)}>
                <Icon size={13} /> {AGENT_NAMES[a]}
              </button>
            );
          })}
        </div>
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 text-[13px] font-semibold text-ob-ink-soft">
          <input type="checkbox" className="size-4 accent-[var(--color-ob-primary)]" checked={problemsOnly} onChange={(e) => setProblemsOnly(e.target.checked)} />
          <TriangleAlert size={14} className="text-ob-danger" /> Only problems
        </label>
      </div>

      {feed.error && <Alert tone="error">{feed.error.message}</Alert>}

      {feed.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      ) : !rows.length ? (
        <EmptyState
          icon={Activity}
          title={problemsOnly ? "No problems" : "Nothing yet"}
          description={problemsOnly ? "No agent step has failed with these filters." : "Agent steps appear here as soon as research, planning or production starts."}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {days.map((d) => (
            <Card key={d.title} bodyClassName="p-2 sm:p-3">
              <div className="flex items-baseline justify-between px-2 pb-1 pt-1 sm:px-3">
                <h2 className="m-0 text-[15px] font-bold">{d.title}</h2>
                <span className="text-[12px] text-ob-muted">
                  {d.rows.length} steps{d.cost > 0 ? ` · ${usd(d.cost)}` : ""}
                </span>
              </div>
              <ol className="m-0 flex list-none flex-col p-0">
                {d.rows.map((row) => (
                  <ActivityRowItem key={row.id} row={row} />
                ))}
              </ol>
            </Card>
          ))}
          {feed.hasNextPage && (
            <button type="button" className={cn(button({ variant: "secondary" }), "self-center")} disabled={feed.isFetchingNextPage} onClick={() => feed.fetchNextPage()}>
              {feed.isFetchingNextPage && <Loader2 size={15} className="animate-spin" />} Load more
            </button>
          )}
        </div>
      )}
    </div>
  );
}
