import { BookOpen, Check, Clock, Globe, Loader2, Palette, TrendingUp, TriangleAlert, type LucideIcon } from "lucide-react";
import type { AgentState, ResearchAgent } from "@/core/onboarding/research";
import { cn } from "@/lib/utils";
import { card } from "@/components/kit/styles";
import { RESEARCH_AGENT_META } from "../../config";

const ICONS: Record<ResearchAgent, LucideIcon> = {
  website_analyst: Globe,
  visual_identity_analyst: Palette,
  social_market_analyst: TrendingUp,
  brand_strategist: BookOpen,
};

const BADGE: Record<AgentState["state"], { label: string; icon: LucideIcon; className: string }> = {
  queued: { label: "Waiting", icon: Clock, className: "bg-ob-sunken text-ob-muted" },
  running: { label: "Working", icon: Loader2, className: "bg-ob-primary-soft text-ob-primary" },
  done: { label: "Done", icon: Check, className: "bg-ob-success-soft text-ob-success" },
  failed: { label: "Didn't finish", icon: TriangleAlert, className: "bg-ob-danger-soft text-ob-danger" },
};

interface AgentCardProps {
  agent: ResearchAgent;
  state: AgentState | undefined;
  /** Latest step summary while it works */
  latest: string | null;
  stepsDone: number;
}

export function AgentCard({ agent, state, latest, stepsDone }: AgentCardProps) {
  const Icon = ICONS[agent];
  const current = state?.state ?? "queued";
  const badge = BADGE[current];
  const BadgeIcon = badge.icon;
  const line = current === "done" ? state?.summary : current === "failed" ? state?.error : latest;

  return (
    <article className={cn(card, "gap-3 p-5", current === "running" && "border-ob-primary/40")}>
      <div className="flex items-start justify-between gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-ob bg-ob-primary-soft text-ob-primary" aria-hidden="true">
          <Icon size={18} />
        </span>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold", badge.className)}>
          <BadgeIcon size={13} className={current === "running" ? "animate-spin" : undefined} aria-hidden="true" />
          {badge.label}
        </span>
      </div>
      <div className="flex flex-col gap-1">
        <h2 className="m-0 text-base font-bold">{RESEARCH_AGENT_META[agent].name}</h2>
        <p className="m-0 text-[13px] text-ob-muted">{RESEARCH_AGENT_META[agent].task}</p>
      </div>
      <p className={cn("m-0 min-h-10 text-sm", current === "failed" ? "text-ob-danger" : "text-ob-ink-soft")} aria-live="polite">
        {line || (current === "queued" ? "Starting soon…" : "Getting started…")}
      </p>
      {stepsDone > 0 && <span className="text-xs text-ob-faint">{stepsDone} steps done</span>}
    </article>
  );
}
