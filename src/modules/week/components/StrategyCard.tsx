import { CalendarHeart, Compass } from "lucide-react";
import { Card } from "@/components/kit/Card";
import { LABELS, type Format } from "@/core/creative/brief";
import type { PlanView } from "@/core/plans/types";

/** The week's idea: theme, the Planner's reasoning, pillar mix against target, and dates it works around. */
export function StrategyCard({ plan }: { plan: PlanView }) {
  const s = plan.strategy;
  const counts = plan.items.reduce<Partial<Record<Format, number>>>((acc, i) => ({ ...acc, [i.format]: (acc[i.format] ?? 0) + 1 }), {});
  const experiments = plan.items.filter((i) => i.is_experiment).length;

  return (
    <Card>
      <div className="flex flex-col gap-5">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-ob-md bg-ob-primary-soft text-ob-primary">
            <Compass size={19} />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ob-faint">This week&apos;s theme</span>
            <strong className="text-lg leading-snug tracking-tight">{s.theme ?? "Planning…"}</strong>
            {s.rationale && <p className="m-0 text-[13.5px] leading-relaxed text-ob-muted">{s.rationale}</p>}
          </div>
        </div>

        {!!s.mix?.length && (
          <div className="flex flex-col gap-2.5">
            <span className="text-[11.5px] font-bold uppercase tracking-[0.08em] text-ob-faint">Pillar mix · planned vs target</span>
            {s.mix.map((m) => (
              <div key={m.pillarId} className="flex flex-col gap-1">
                <div className="flex justify-between gap-2 text-[12.5px]">
                  <span className="truncate font-semibold">{m.name}</span>
                  <span className="shrink-0 tabular-nums text-ob-muted">
                    {Math.round(m.planned * 100)}% <span className="text-ob-faint">/ {Math.round(m.target * 100)}%</span>
                  </span>
                </div>
                <div className="relative h-2 rounded-full bg-ob-sunken">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-ob-primary transition-[width] duration-500" style={{ width: `${Math.min(100, m.planned * 100)}%` }} />
                  <div className="absolute -inset-y-0.5 w-0.5 rounded bg-ob-ink/50" style={{ left: `${Math.min(99, m.target * 100)}%` }} title="Target" />
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {(Object.entries(counts) as [Format, number][]).map(([f, n]) => (
            <span key={f} className="rounded-full bg-ob-sunken px-2.5 py-1 text-xs font-semibold text-ob-ink-soft">
              {n} × {LABELS.format[f]}
            </span>
          ))}
          {experiments > 0 && <span className="rounded-full bg-ob-primary-soft px-2.5 py-1 text-xs font-semibold text-ob-primary">{experiments} experiments</span>}
        </div>

        {!!s.events?.length && (
          <div className="flex flex-wrap items-center gap-2">
            <CalendarHeart size={15} className="text-ob-warn" />
            {s.events.map((e) => (
              <span key={e} className="rounded-full bg-ob-warn-soft px-2.5 py-1 text-xs font-semibold text-ob-warn">
                {e}
              </span>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
