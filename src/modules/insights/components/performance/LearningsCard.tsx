"use client";

import { useState } from "react";
import { Card } from "@/components/kit/Card";
import type { PerformanceView } from "@/core/performance/dashboard";
import { LABELS as BRIEF_LABELS } from "@/core/creative/brief";
import { STYLE_NAMES } from "@/core/content/styles";
import { cn } from "@/lib/utils";
import { Segmented } from "../shared/Segmented";

const DIMENSIONS: Record<string, string> = {
  time_slot: "Posting time",
  format: "Format",
  style: "Content style",
  hook_type: "Hook type",
  pillar: "Pillar",
  persona: "Persona",
  angle: "Angle",
  framework: "Framework",
  lever: "Lever",
};

/** Readable value: format, style, hook, framework and lever ids get their names. */
function valueLabel(dimension: string, label: string): string {
  const map: Record<string, Record<string, string>> = { format: BRIEF_LABELS.format, style: STYLE_NAMES, hook_type: BRIEF_LABELS.hook, framework: BRIEF_LABELS.framework, lever: BRIEF_LABELS.lever };
  return map[dimension]?.[label] ?? label;
}

const MAX = 2.5;

/**
 * Diverging bars around "usual" (1.0×): better to the right in the primary hue, weaker to the
 * left in the warm hue, a neutral centre line. Confidence is shown as dots, not colour.
 */
function ScoreBar({ score }: { score: number }) {
  const s = Math.min(MAX, Math.max(0, score));
  const half = 50;
  const width = s >= 1 ? ((s - 1) / (MAX - 1)) * half : ((1 - s) / 1) * half;
  return (
    <div className="relative h-2.5 w-full rounded-full bg-ob-sunken" aria-hidden="true">
      <span className="absolute inset-y-[-3px] left-1/2 w-px bg-ob-line-strong" />
      <span
        className={cn("absolute inset-y-0 rounded-full transition-[width] duration-500", s >= 1 ? "left-1/2 bg-ob-primary" : "right-1/2 bg-ob-warn/70")}
        style={{ width: `${Math.max(2, width)}%` }}
      />
    </div>
  );
}

function Confidence({ value, sample }: { value: number; sample: number }) {
  const dots = value >= 0.75 ? 3 : value >= 0.5 ? 2 : 1;
  return (
    <span className="inline-flex items-center gap-1 text-[11.5px] text-ob-muted" title={`${Math.round(value * 100)}% confident, from ${sample} posts`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={cn("size-1.5 rounded-full", i < dots ? "bg-ob-ink-soft" : "bg-ob-line-strong")} />
      ))}
      {sample} posts
    </span>
  );
}

/** What's working: each learning against the account's usual engagement, with the analyst's insight. */
export function LearningsCard({ learnings }: { learnings: PerformanceView["learnings"] }) {
  const [view, setView] = useState<"all" | "better" | "weaker">("all");
  const shown = learnings.filter((l) => (view === "better" ? l.score >= 1 : view === "weaker" ? l.score < 1 : true));
  return (
    <Card
      title="What's working"
      description="Each idea's posts against your usual engagement (1.0× = usual). Learnings with under 5 posts are early signs."
      actions={
        <Segmented
          label="Show"
          value={view}
          onChange={setView}
          options={[
            { value: "all", label: "All" },
            { value: "better", label: "Better" },
            { value: "weaker", label: "Weaker" },
          ]}
        />
      }
    >
      {shown.length ? (
        <ul className="m-0 grid list-none grid-cols-1 gap-x-8 gap-y-5 p-0 lg:grid-cols-2">
          {shown.map((l) => (
            <li key={`${l.dimension}|${l.value}`} className="flex flex-col gap-2">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold uppercase tracking-[0.06em] text-ob-faint">{DIMENSIONS[l.dimension] ?? l.dimension}</span>
                  <span className="block truncate text-[14px] font-semibold text-ob-ink">{valueLabel(l.dimension, l.label)}</span>
                </span>
                <span className={cn("shrink-0 text-[15px] font-extrabold tabular-nums", l.score >= 1 ? "text-ob-primary" : "text-ob-warn")}>{l.score.toFixed(2)}×</span>
              </div>
              <ScoreBar score={l.score} />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Confidence value={l.confidence} sample={l.sample} />
              </div>
              {l.insight && <p className="m-0 text-[13px] leading-relaxed text-ob-muted">{l.insight}</p>}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 text-sm text-ob-muted">No learnings yet. They appear after about a week of posting, and grow more confident with every post.</p>
      )}
    </Card>
  );
}
