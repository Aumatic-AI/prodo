import { Check, Loader2, Minus } from "lucide-react";
import type { ResearchActivity } from "@/core/onboarding/progress";
import type { ResearchAgent } from "@/core/onboarding/research";
import { card, sectionTitle } from "@/components/kit/styles";
import { RESEARCH_AGENT_META } from "../../config";

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

/** Every step the agents logged, newest first. Failed optional steps read as "skipped". */
export function ActivityFeed({ activity }: { activity: ResearchActivity[] }) {
  return (
    <section className={card} aria-label="Research activity">
      <h2 className={sectionTitle}>What the agents are doing</h2>
      {activity.length === 0 ? (
        <p className="m-0 text-sm text-ob-faint">The first steps show up here in a few seconds.</p>
      ) : (
        <ol className="m-0 flex list-none flex-col divide-y divide-ob-line p-0">
          {activity.map((a) => {
            const name = RESEARCH_AGENT_META[a.agent as ResearchAgent]?.name ?? a.agent;
            return (
              <li key={a.id} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-start gap-3 py-2.5 text-sm">
                <span className="mt-0.5 text-ob-faint" aria-hidden="true">
                  {a.status === "running" ? (
                    <Loader2 size={15} className="animate-spin text-ob-primary" />
                  ) : a.status === "done" ? (
                    <Check size={15} className="text-ob-success" />
                  ) : (
                    <Minus size={15} />
                  )}
                </span>
                <span className="min-w-0">
                  <span className="mr-2 font-semibold text-ob-muted">{name}</span>
                  {a.status === "failed" ? <span className="text-ob-muted">Skipped a step: {a.error}</span> : (a.summary ?? "Working…")}
                </span>
                <time className="whitespace-nowrap text-xs text-ob-faint" dateTime={a.createdAt}>
                  {time(a.createdAt)}
                </time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
