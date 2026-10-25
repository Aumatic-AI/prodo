import { CalendarDays, ChevronLeft, ChevronRight, Columns3 } from "lucide-react";
import { button, focusRing } from "@/components/kit/styles";
import { platformMeta } from "@/config/platforms";
import { cn } from "@/lib/utils";

export type View = "month" | "week";
export type Layer = "posts" | "planned" | "dates";

const LAYERS: { value: Layer; label: string }[] = [
  { value: "posts", label: "Posts" },
  { value: "planned", label: "Planned" },
  { value: "dates", label: "Dates" },
];

interface Props {
  title: string;
  view: View;
  onView: (v: View) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  platforms: string[];
  platform: string | null;
  onPlatform: (p: string | null) => void;
  layers: Layer[];
  onLayer: (l: Layer) => void;
}

const pill = (on: boolean) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors",
    focusRing,
    on ? "border-ob-primary bg-ob-primary-soft text-ob-primary" : "border-ob-line bg-ob-surface text-ob-muted hover:border-ob-line-strong hover:text-ob-ink"
  );

/** Title, prev/next/today, Month/Week switch and the filters. */
export function CalendarToolbar(p: Props) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button type="button" className={button({ variant: "secondary", size: "icon" })} onClick={p.onPrev} aria-label="Previous">
            <ChevronLeft size={17} />
          </button>
          <button type="button" className={button({ variant: "secondary", size: "icon" })} onClick={p.onNext} aria-label="Next">
            <ChevronRight size={17} />
          </button>
          <h2 className="m-0 ml-1 text-xl font-extrabold tracking-tight">{p.title}</h2>
          <button type="button" className={button({ variant: "ghost", size: "xs" })} onClick={p.onToday}>
            Today
          </button>
        </div>
        <div className="flex rounded-ob-md border border-ob-line bg-ob-sunken p-0.5" role="tablist" aria-label="Calendar view">
          {(
            [
              ["month", "Month", CalendarDays],
              ["week", "Week", Columns3],
            ] as const
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={p.view === value}
              onClick={() => p.onView(value)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-ob px-3 py-1.5 text-[13px] font-bold transition-all",
                focusRing,
                p.view === value ? "bg-ob-surface text-ob-ink shadow-ob-sm" : "text-ob-muted hover:text-ob-ink"
              )}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Platform">
          <button type="button" className={pill(!p.platform)} onClick={() => p.onPlatform(null)}>
            All platforms
          </button>
          {p.platforms.map((id) => {
            const meta = platformMeta(id);
            const Icon = meta.icon;
            return (
              <button key={id} type="button" className={pill(p.platform === id)} onClick={() => p.onPlatform(p.platform === id ? null : id)}>
                <Icon size={13} style={{ color: meta.color }} /> {meta.label}
              </button>
            );
          })}
        </div>
        <div className="flex gap-1.5" role="group" aria-label="Show">
          {LAYERS.map((l) => (
            <button key={l.value} type="button" aria-pressed={p.layers.includes(l.value)} className={pill(p.layers.includes(l.value))} onClick={() => p.onLayer(l.value)}>
              <span className={cn("size-2 rounded-full", l.value === "posts" ? "bg-ob-primary" : l.value === "planned" ? "border border-dashed border-ob-muted" : "bg-ob-warn")} />
              {l.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
