"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, CalendarCheck, CheckCheck, ChevronRight, LineChart, Mail, Sparkles, TriangleAlert, XCircle, type LucideIcon } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { EmptyState } from "@/components/kit/EmptyState";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button, focusRing } from "@/components/kit/styles";
import type { Notification, NotificationKind } from "@/core/notifications/notify";
import { cn } from "@/lib/utils";
import { useMarkRead, useNotifications } from "../hooks/useNotifications";

const KIND: Record<NotificationKind, { icon: LucideIcon; className: string; label: string }> = {
  plan_ready: { icon: Sparkles, className: "bg-ob-success-soft text-ob-success", label: "Plan ready" },
  ad_ready: { icon: Sparkles, className: "bg-ob-success-soft text-ob-success", label: "Ad ready" },
  item_needs_review: { icon: TriangleAlert, className: "bg-ob-warn-soft text-ob-warn", label: "Needs a look" },
  plan_scheduled: { icon: CalendarCheck, className: "bg-ob-primary-soft text-ob-primary", label: "Scheduled" },
  post_failed: { icon: XCircle, className: "bg-ob-danger-soft text-ob-danger", label: "Post failed" },
  agent_stopped: { icon: TriangleAlert, className: "bg-ob-danger-soft text-ob-danger", label: "Stopped" },
  budget_reached: { icon: TriangleAlert, className: "bg-ob-warn-soft text-ob-warn", label: "Budget" },
  weekly_report: { icon: LineChart, className: "bg-ob-primary-soft text-ob-primary", label: "Weekly report" },
};

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400_000);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
}

const time = (iso: string) => new Date(iso).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });

function Row({ n, onOpen }: { n: Notification; onOpen: () => void }) {
  const kind = KIND[n.kind] ?? KIND.plan_ready;
  const Icon = kind.icon;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "group flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-ob-sunken",
        !n.read_at && "bg-ob-primary-soft/40",
        focusRing
      )}
    >
      <span className={cn("grid size-10 shrink-0 place-items-center rounded-full", kind.className)}>
        <Icon size={18} />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className={cn("text-[14.5px] leading-snug", n.read_at ? "font-semibold text-ob-ink-soft" : "font-bold text-ob-ink")}>{n.title}</span>
          {!n.read_at && <span className="size-2 rounded-full bg-ob-primary" aria-label="Unread" />}
        </span>
        {n.body && <span className="whitespace-pre-line text-[13.5px] leading-relaxed text-ob-muted">{n.body}</span>}
        <span className="flex flex-wrap items-center gap-3 text-xs text-ob-faint">
          <span>{time(n.created_at)}</span>
          <span>{kind.label}</span>
          {(n.email_status === "sent" || n.email_status === "skipped") && (
            <span className="inline-flex items-center gap-1" title={n.email_status === "sent" ? "Also emailed" : "Email sending is switched off for now"}>
              <Mail size={12} /> {n.email_status === "sent" ? "Emailed" : "Email off"}
            </span>
          )}
        </span>
      </span>
      {n.link && <ChevronRight size={18} className="mt-2.5 shrink-0 text-ob-faint transition-transform group-hover:translate-x-0.5" />}
    </button>
  );
}

/** Everything the agents told the client: plans ready, posts that need a look, failures, reports. */
export function NotificationsPage() {
  const router = useRouter();
  const { data, isLoading, error } = useNotifications();
  const read = useMarkRead();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const items = (data?.items ?? []).filter((n) => filter === "all" || !n.read_at);
  const groups = items.reduce<{ label: string; items: Notification[] }[]>((acc, n) => {
    const label = dayLabel(n.created_at);
    const last = acc[acc.length - 1];
    if (last?.label === label) last.items.push(n);
    else acc.push({ label, items: [n] });
    return acc;
  }, []);

  function open(n: Notification) {
    if (!n.read_at) read.mutate([n.id]);
    if (n.link) router.push(n.link);
  }

  return (
    <div className="mx-auto flex max-w-[860px] flex-col gap-6">
      <PageHeader
        title="Notifications"
        description="Plans ready for you, posts that need a look, anything that failed, and your weekly report."
        actions={
          (data?.unread ?? 0) > 0 && (
            <button type="button" className={button({ variant: "secondary", size: "sm" })} disabled={read.isPending} onClick={() => read.mutate("all")}>
              <CheckCheck size={15} /> Mark all read
            </button>
          )
        }
      />

      <div className="flex gap-1.5" role="tablist" aria-label="Show">
        {(
          [
            ["all", "All"],
            ["unread", `Unread${data?.unread ? ` (${data.unread})` : ""}`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={filter === value}
            onClick={() => setFilter(value)}
            className={cn(
              "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors",
              filter === value ? "border-ob-primary bg-ob-primary-soft text-ob-primary" : "border-ob-line bg-ob-surface text-ob-muted hover:border-ob-line-strong"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <Alert tone="error">{error.message}</Alert>}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
      ) : !groups.length ? (
        <EmptyState
          icon={Bell}
          title={filter === "unread" ? "You're all caught up" : "Nothing yet"}
          description="You'll hear here when a plan is ready, a post needs your look, something fails, or your weekly report arrives."
        />
      ) : (
        groups.map((g) => (
          <section key={g.label} className="flex flex-col gap-2">
            <h2 className="m-0 px-1 text-[12px] font-bold uppercase tracking-[0.08em] text-ob-faint">{g.label}</h2>
            <div className="divide-y divide-ob-line overflow-hidden rounded-ob-lg border border-ob-line bg-ob-surface shadow-ob-xs">
              {g.items.map((n) => (
                <Row key={n.id} n={n} onOpen={() => open(n)} />
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
