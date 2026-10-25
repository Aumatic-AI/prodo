"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowRight, CircleCheck, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { RESEARCH_AGENTS } from "@/core/onboarding/research";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/SessionStoreProvider";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { Alert } from "../../components/blocks";
import { button, card, container } from "@/components/kit/styles";
import { useResearchProgress, useRetryResearch } from "../../hooks/useResearchProgress";
import { ActivityFeed } from "./ActivityFeed";
import { AgentCard } from "./AgentCard";

function minutesSince(iso: string): number {
  return Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
}

/**
 * Live brand research after submit. Safe to leave and come back: everything is read from the
 * server, so a reload or a later visit shows exactly where the research is.
 */
export function ProgressStep() {
  const name = useSession((s) => s.business.name);
  const { data, isLoading, error } = useResearchProgress();
  const retry = useRetryResearch();
  const setStatus = useOnboarding((s) => s.setStatus);
  const updateBusiness = useSession((s) => s.updateBusiness);

  // Research finished while this page was open: the Bible review is allowed now
  useEffect(() => {
    if (data?.status === "review") {
      setStatus("review");
      updateBusiness({ onboardingStatus: "review" });
    }
  }, [data?.status, setStatus, updateBusiness]);

  const research = data?.research;
  const state = research?.state ?? "running";
  const latestFor = (agent: string) => data?.activity.find((a) => a.agent === agent && a.status !== "failed")?.summary ?? null;
  const done = RESEARCH_AGENTS.filter((a) => research?.agents[a]?.state === "done").length;

  const title = state === "done" ? "Research finished" : state === "failed" ? "Research needs another go" : "We're researching your brand";
  const lead =
    state === "done"
      ? "Your Brand Bible is written. Review it, confirm what we found on your website, and approve it to finish."
      : state === "failed"
        ? "Most of the work is saved. Retry to run only the parts that didn't finish."
        : "Our agents are reading your website, visuals, socials and competitors. It takes about 10 minutes. You can close this page: the research keeps going, and this page shows where it is when you come back.";

  const retryButton = (
    <button type="button" className={button()} onClick={() => retry.mutate()} disabled={retry.isPending}>
      {retry.isPending ? <Loader2 size={16} className="animate-spin" /> : <RotateCcw size={16} />}
      Retry
    </button>
  );

  return (
    <main className={cn(container, "flex max-w-[1180px] flex-col gap-5 pb-16 pt-8")}>
      <section className={cn(card, "items-start gap-3")}>
        <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-ob-primary">Getting to know {name || "your brand"}</span>
        <div className="flex w-full flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-ob-primary-soft text-ob-primary" aria-hidden="true">
              {state === "done" ? <CircleCheck size={22} /> : <Sparkles size={22} />}
            </span>
            <h1 className="m-0 text-[28px] font-extrabold leading-tight tracking-tight">{title}</h1>
          </div>
          {/* The next step sits at the top, so it's visible without scrolling */}
          {state === "done" && (
            <Link href="/onboarding/bible" className={button()}>
              Review your Brand Bible <ArrowRight size={16} />
            </Link>
          )}
        </div>
        <p className="m-0 max-w-[680px] text-base text-ob-muted">{lead}</p>

        <div className="flex w-full flex-col gap-1.5">
          <div className="h-2 w-full overflow-hidden rounded-full bg-ob-line" role="progressbar" aria-valuemin={0} aria-valuemax={RESEARCH_AGENTS.length} aria-valuenow={done}>
            <div className="h-full rounded-full bg-ob-primary transition-[width] duration-500" style={{ width: `${Math.max(4, (done / RESEARCH_AGENTS.length) * 100)}%` }} />
          </div>
          <span className="text-xs text-ob-faint">
            {done} of {RESEARCH_AGENTS.length} agents finished
            {research?.startedAt && ` · started ${minutesSince(research.startedAt)} min ago`}
            {data && data.costUsd > 0 && ` · research cost so far $${data.costUsd.toFixed(2)}`}
          </span>
        </div>
      </section>

      {error && <Alert tone="error">{error.message}</Alert>}
      {retry.error && <Alert tone="error">{retry.error.message}</Alert>}
      {state === "failed" && (
        <Alert tone="error">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>{research?.error ?? "Some research didn't finish."}</span>
            {retryButton}
          </div>
        </Alert>
      )}
      {state === "running" && data?.stale && (
        <Alert tone="warn">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span>This is taking longer than it should. Nothing has happened for a while; retry to start the unfinished parts again.</span>
            {retryButton}
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {RESEARCH_AGENTS.map((agent) =>
          isLoading ? (
            <div key={agent} className="h-[210px] animate-pulse rounded-ob-lg bg-ob-line" />
          ) : (
            <AgentCard key={agent} agent={agent} state={research?.agents[agent]} latest={latestFor(agent)} stepsDone={data?.stepsDone[agent] ?? 0} />
          )
        )}
      </div>

      <ActivityFeed activity={data?.activity ?? []} />
    </main>
  );
}
