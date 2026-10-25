"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarRange, Loader2, Sparkles, Wand2 } from "lucide-react";
import { button } from "@/components/kit/styles";
import { apiFetch } from "@/lib/api-client";
import type { AutomationView } from "@/core/settings";
import { useRequestPlan } from "../hooks/usePlan";
import { weekRange } from "../lib/time";

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** No plan for this week yet: what happens automatically, and the button to plan now. */
export function EmptyWeek({
  weekStart,
  isPast,
  lastDay,
  requested,
  onRequested,
  onCreateAd,
  onPlanNext,
}: {
  weekStart: string;
  isPast: boolean;
  /** Today is this week's last day: slots start tomorrow, so plan next week instead */
  lastDay: boolean;
  requested: boolean;
  onRequested: () => void;
  onCreateAd: () => void;
  onPlanNext: () => void;
}) {
  const request = useRequestPlan();
  const { data: automation } = useQuery<AutomationView>({ queryKey: ["settings", "automation"], queryFn: () => apiFetch("/api/settings/automation") });
  const waiting = requested || request.isPending;

  return (
    <section className="relative overflow-hidden rounded-ob-lg border border-ob-line bg-ob-surface px-6 py-14 text-center shadow-ob-xs">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60%_80%_at_50%_0%,var(--color-ob-primary-soft),transparent)]" aria-hidden="true" />
      <div className="relative mx-auto flex max-w-[560px] flex-col items-center gap-4">
        <span className="grid size-14 place-items-center rounded-2xl bg-ob-primary text-ob-on-primary shadow-ob-sm">
          {waiting ? <Loader2 size={24} className="animate-spin" /> : <CalendarRange size={24} />}
        </span>
        <h2 className="m-0 text-2xl font-extrabold tracking-tight">{waiting ? "The Planner is on it" : `No plan for ${weekRange(weekStart)} yet`}</h2>
        <p className="m-0 text-[15px] leading-relaxed text-ob-muted">
          {waiting
            ? "It picks days, formats and ideas from your Brand Bible, then the Creative Director, Producer and QA make every post. This page fills in as they work."
            : lastDay
              ? "This week ends today, and posts are only planned from tomorrow on. Plan next week instead."
              : automation
              ? `Prodo plans the next week every ${DAYS[automation.plan_weekday]} at ${automation.plan_time}${automation.paused ? " (paused right now)" : ""}. You can also plan it now, or make a single ad.`
              : "Plan the week now, or make a single ad."}
        </p>
        {!waiting && !isPast && (
          <div className="mt-2 flex flex-wrap justify-center gap-2.5">
            {lastDay ? (
              <button type="button" className={button()} onClick={onPlanNext}>
                <Wand2 size={17} /> Plan next week
              </button>
            ) : (
              <button type="button" className={button()} onClick={() => request.mutate({ week: weekStart }, { onSuccess: onRequested })}>
                <Wand2 size={17} /> Plan this week
              </button>
            )}
            <button type="button" className={button({ variant: "secondary" })} onClick={onCreateAd}>
              <Sparkles size={16} /> Create a single ad
            </button>
          </div>
        )}
        {request.error && <p className="m-0 text-sm text-ob-danger">{request.error.message}</p>}
      </div>
    </section>
  );
}
