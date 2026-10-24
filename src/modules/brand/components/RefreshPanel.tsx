"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Clock, Loader2, RefreshCw, RotateCcw, TriangleAlert } from "lucide-react";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { button } from "@/components/kit/styles";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { RESEARCH_AGENTS } from "@/core/onboarding/research";
import type { ResearchProgress } from "@/core/onboarding/progress";
import { RESEARCH_AGENT_META } from "@/modules/onboarding/config";
import { useResearchProgress, useRetryResearch } from "@/modules/onboarding/hooks/useResearchProgress";

const STATE = {
  queued: { icon: Clock, className: "text-ob-faint" },
  running: { icon: Loader2, className: "animate-spin text-ob-primary" },
  done: { icon: Check, className: "text-ob-success" },
  failed: { icon: TriangleAlert, className: "text-ob-danger" },
} as const;

/** True while a refresh runs or after one failed (so the progress card shows). */
export function useRefreshActive() {
  const { data } = useResearchProgress();
  const state = data?.research?.state;
  return state === "running" || state === "failed";
}

/** "Refresh brand": runs the research again and writes a new Brand Bible draft. */
export function RefreshButton() {
  const queryClient = useQueryClient();
  const active = useRefreshActive();
  const [confirming, setConfirming] = useState(false);
  const refresh = useMutation({
    mutationFn: () => apiFetch<ResearchProgress>("/api/brand/refresh", { method: "POST" }),
    onSuccess: (progress) => queryClient.setQueryData(["onboarding", "progress"], progress),
  });

  return (
    <>
      <button type="button" className={button({ variant: "secondary", size: "sm" })} disabled={active} onClick={() => setConfirming(true)}>
        <RefreshCw size={15} className={active ? "animate-spin" : undefined} />
        {active ? "Refreshing…" : "Refresh brand"}
      </button>
      <ConfirmDialog
        open={confirming}
        onOpenChange={setConfirming}
        title="Refresh your brand?"
        description={
          <p className="m-0">
            The agents read your website, visuals, socials and competitors again and write a new Brand Bible draft. Your current Bible stays in use until you
            approve the new one. It takes about 10 minutes and uses some of this month&apos;s budget.
          </p>
        }
        confirmLabel="Refresh"
        busy={refresh.isPending}
        error={refresh.error?.message}
        onConfirm={async () => {
          await refresh.mutateAsync();
          setConfirming(false);
        }}
      />
    </>
  );
}

/** Each agent's progress while a refresh runs, with Retry when it failed or got stuck. */
export function RefreshProgress() {
  const { data } = useResearchProgress();
  const retry = useRetryResearch();
  const research = data?.research;
  if (!research || (research.state !== "running" && research.state !== "failed")) return null;
  const done = RESEARCH_AGENTS.filter((a) => research.agents[a]?.state === "done").length;

  return (
    <section className="flex flex-col gap-4 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <strong className="text-base">{research.state === "running" ? "Refreshing your brand" : "The refresh didn't finish"}</strong>
          <span className="text-[13px] text-ob-muted">
            {done} of {RESEARCH_AGENTS.length} agents finished{data?.costUsd ? ` · $${data.costUsd.toFixed(2)} so far` : ""} · your current Bible stays in use
          </span>
        </div>
        {(research.state === "failed" || data?.stale) && (
          <button type="button" className={button({ size: "sm" })} disabled={retry.isPending} onClick={() => retry.mutate()}>
            <RotateCcw size={15} /> Retry unfinished parts
          </button>
        )}
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-ob-line">
        <div className="h-full rounded-full bg-ob-primary transition-[width] duration-500" style={{ width: `${Math.max(4, (done / RESEARCH_AGENTS.length) * 100)}%` }} />
      </div>
      <ul className="m-0 grid list-none grid-cols-1 gap-2.5 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {RESEARCH_AGENTS.map((agent) => {
          const a = research.agents[agent];
          const state = a?.state ?? "queued";
          const { icon: Icon, className } = STATE[state];
          const line = state === "failed" ? a?.error : (a?.summary ?? data?.activity.find((x) => x.agent === agent && x.summary)?.summary);
          return (
            <li key={agent} className="flex gap-2.5 rounded-ob-md bg-ob-bg p-3">
              <Icon size={16} className={cn("mt-0.5 shrink-0", className)} />
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-bold">{RESEARCH_AGENT_META[agent].name}</span>
                <span className={cn("line-clamp-2 text-[13px]", state === "failed" ? "text-ob-danger" : "text-ob-muted")}>{line ?? "Waiting"}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
