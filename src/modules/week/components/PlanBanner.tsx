"use client";

import { useState } from "react";
import { CalendarCheck, CheckCheck, Loader2, RotateCcw, Sparkles, TriangleAlert } from "lucide-react";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { button } from "@/components/kit/styles";
import { SETTLED, type PlanView } from "@/core/plans/types";
import { cn } from "@/lib/utils";
import { useApprovePlan, useRequestPlan } from "../hooks/usePlan";
import { timeUntil } from "../lib/time";

type Tone = "danger" | "work" | "ready" | "done";

const ICON = { danger: TriangleAlert, work: Loader2, ready: Sparkles, done: CalendarCheck };

/** Where the plan is right now, with the one action that moves it on. */
export function PlanBanner({ plan, latest }: { plan: PlanView; latest: string | null }) {
  const approve = useApprovePlan();
  const again = useRequestPlan();
  const [confirm, setConfirm] = useState(false);

  const total = plan.items.length;
  const settled = plan.items.filter((i) => SETTLED.includes(i.status)).length;
  const ready = plan.items.filter((i) => i.status === "ready").length;
  const review = plan.items.filter((i) => i.status === "needs_review").length;
  const scheduled = plan.items.filter((i) => i.status === "scheduled" || i.status === "published").length;
  const progress = total ? Math.round((settled / total) * 100) : 0;

  const working = plan.status === "planning" || plan.status === "producing";
  const tone: Tone = plan.status === "failed" ? "danger" : working ? "work" : plan.status === "review" ? "ready" : "done";
  const Icon = ICON[tone];

  let title: string;
  let line: string;
  if (plan.status === "planning") {
    title = "The Planner is planning your week";
    line = latest ?? "Picking days, formats and ideas from your Brand Bible and what has worked.";
  } else if (plan.status === "producing") {
    title = `Making your posts · ${settled} of ${total} done`;
    line = latest ?? "Each post is written, checked, made and checked again before you see it.";
  } else if (plan.status === "review") {
    title = `Your week is ready · ${ready} to approve${review ? `, ${review} need a look` : ""}`;
    line = plan.approval_due_at
      ? `Full autopilot approves the ready posts by itself in ${timeUntil(plan.approval_due_at)}. Posts that need a look never go out without you.`
      : "Approve the plan to schedule every ready post at its time. Open any post first to change it.";
  } else if (plan.status === "failed") {
    title = "Planning stopped";
    line = plan.error ?? "Something went wrong. Plan again.";
  } else {
    title = `${scheduled} of ${total} posts scheduled`;
    line = "They go out at their planned times. Cancel any of them in Posts.";
  }

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-ob-lg border p-5 shadow-ob-xs",
        tone === "ready" && "border-ob-success/30 bg-linear-to-r from-ob-success-soft to-ob-surface",
        tone === "work" && "border-ob-primary/25 bg-linear-to-r from-ob-primary-soft to-ob-surface",
        tone === "danger" && "border-ob-danger/30 bg-ob-danger-soft",
        tone === "done" && "border-ob-line bg-ob-surface"
      )}
    >
      <div className="flex flex-wrap items-center gap-4">
        <span
          className={cn(
            "grid size-11 shrink-0 place-items-center rounded-ob-md",
            tone === "ready" && "bg-ob-success text-ob-on-primary",
            tone === "work" && "bg-ob-primary text-ob-on-primary",
            tone === "danger" && "bg-ob-danger text-ob-on-primary",
            tone === "done" && "bg-ob-dark text-ob-on-dark"
          )}
        >
          <Icon size={20} className={working ? "animate-spin" : undefined} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <strong className="text-[17px] tracking-tight">{title}</strong>
          <span className="text-[13.5px] text-ob-muted">{line}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {plan.costUsd > 0 && <span className="rounded-full bg-ob-surface/80 px-3 py-1 text-xs font-semibold text-ob-muted ring-1 ring-ob-line">${plan.costUsd.toFixed(2)} spent</span>}
          {plan.status === "review" && ready > 0 && (
            <button type="button" className={button()} onClick={() => setConfirm(true)}>
              <CheckCheck size={17} /> Approve {ready} {ready === 1 ? "post" : "posts"}
            </button>
          )}
          {plan.status === "failed" && (
            <button type="button" className={button()} disabled={again.isPending} onClick={() => again.mutate({ week: plan.week_start, replace: true })}>
              <RotateCcw size={16} /> Plan again
            </button>
          )}
        </div>
      </div>
      {working && total > 0 && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-ob-surface">
          <div className="h-full rounded-full bg-ob-primary transition-[width] duration-700" style={{ width: `${Math.max(4, progress)}%` }} />
        </div>
      )}
      {again.error && <p className="m-0 mt-3 text-sm text-ob-danger">{again.error.message}</p>}

      <ConfirmDialog
        open={confirm}
        onOpenChange={setConfirm}
        title={`Approve ${ready} ${ready === 1 ? "post" : "posts"}?`}
        description={
          <p className="m-0">
            The Publisher schedules each one at its planned time on your connected accounts.
            {review ? ` The ${review} that need a look stay here until you decide.` : ""} You can cancel any scheduled post in Posts.
          </p>
        }
        confirmLabel="Approve and schedule"
        busy={approve.isPending}
        error={approve.error?.message}
        onConfirm={async () => {
          await approve.mutateAsync(plan.id);
          setConfirm(false);
        }}
      />
    </section>
  );
}
