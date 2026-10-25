import { ArrowRight, Newspaper } from "lucide-react";
import type { PerformanceView } from "@/core/performance/dashboard";
import { shortDate } from "../../lib/format";

/** The Performance Analyst's latest weekly report, as the page's lead. */
export function ReportCard({ report }: { report: NonNullable<PerformanceView["report"]> }) {
  return (
    <section className="relative overflow-hidden rounded-ob-lg border border-ob-primary/20 bg-linear-to-br from-ob-primary-soft via-ob-surface to-ob-surface p-5 shadow-ob-xs sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:gap-8">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-ob-primary">
            <Newspaper size={14} /> Weekly report · week of {shortDate(report.week_start)}
          </span>
          <h2 className="m-0 text-xl font-extrabold leading-snug tracking-tight text-ob-ink sm:text-[22px]">{report.headline}</h2>
          <p className="m-0 text-[14.5px] leading-relaxed text-ob-ink-soft">{report.summary}</p>
        </div>
        {report.next_week.length > 0 && (
          <div className="flex shrink-0 flex-col gap-2 rounded-ob-md bg-ob-surface/80 p-4 ring-1 ring-ob-line lg:w-[360px]">
            <span className="text-[12px] font-bold uppercase tracking-[0.06em] text-ob-muted">Next week the Planner will</span>
            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {report.next_week.map((n, i) => (
                <li key={i} className="flex gap-2 text-[13.5px] leading-snug text-ob-ink">
                  <ArrowRight size={14} className="mt-0.5 shrink-0 text-ob-primary" />
                  {n}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
