import { CalendarCheck2, CalendarClock, Flag, Sparkles } from "lucide-react";
import type { CalendarEvent, Entry } from "../lib/types";

/** Four numbers for the month in view. */
export function MonthStats({ entries, events }: { entries: Entry[]; events: CalendarEvent[] }) {
  const posts = entries.filter((e) => e.kind === "post");
  const stats = [
    { label: "Scheduled", value: posts.filter((e) => e.status === "scheduled" || e.status === "publishing").length, icon: CalendarClock, tone: "text-ob-primary bg-ob-primary-soft" },
    { label: "Published", value: posts.filter((e) => e.status === "published" || e.status === "partial").length, icon: CalendarCheck2, tone: "text-ob-success bg-ob-success-soft" },
    { label: "Planned", value: entries.filter((e) => e.kind === "item").length, icon: Sparkles, tone: "text-ob-ink-soft bg-ob-sunken" },
    { label: "Key dates", value: events.length, icon: Flag, tone: "text-ob-warn bg-ob-warn-soft" },
  ];
  return (
    <section className="grid grid-cols-2 gap-2.5">
      {stats.map((s) => (
        <div key={s.label} className="flex items-center gap-3 rounded-ob-lg border border-ob-line bg-ob-surface p-3.5 shadow-ob-xs">
          <span className={`grid size-9 shrink-0 place-items-center rounded-ob ${s.tone}`}>
            <s.icon size={17} />
          </span>
          <span className="flex flex-col">
            <span className="text-xl font-extrabold leading-none tabular-nums">{s.value}</span>
            <span className="mt-1 text-xs font-semibold text-ob-muted">{s.label}</span>
          </span>
        </div>
      ))}
    </section>
  );
}
