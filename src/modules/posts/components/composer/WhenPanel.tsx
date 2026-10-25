"use client";

import { Clock, FileText, Loader2, Send } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { DatePicker } from "@/components/kit/DatePicker";
import { TimePicker } from "@/components/kit/TimePicker";
import { button, focusRing } from "@/components/kit/styles";
import { cn } from "@/lib/utils";
import { dayLabel, relative, timeOfDay } from "../../lib/format";

export type WhenOption = "now" | "schedule" | "draft";

const OPTIONS = [
  { value: "now", label: "Publish now", note: "Goes out in a minute", icon: Send },
  { value: "schedule", label: "Schedule", note: "Pick a day and time", icon: Clock },
  { value: "draft", label: "Save as draft", note: "Finish it later", icon: FileText },
] as const;

interface WhenPanelProps {
  when: WhenOption;
  onWhen: (when: WhenOption) => void;
  date: string;
  onDate: (date: string) => void;
  time: string;
  onTime: (time: string) => void;
  scheduledAt: Date | null;
  accountCount: number;
  missingCaptions: number;
  busy: boolean;
  error: string | null;
  onSubmit: () => void;
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

/** When it goes out, a short summary and the main button. */
export function WhenPanel(p: WhenPanelProps) {
  const inPast = p.when === "schedule" && !!p.scheduledAt && p.scheduledAt.getTime() < Date.now();
  const blocked = !p.accountCount || (p.when === "schedule" && (!p.scheduledAt || inPast));
  const cta = p.when === "draft" ? "Save draft" : p.when === "schedule" ? "Schedule post" : "Publish now";

  return (
    <section className="flex flex-col gap-4 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
      <h2 className="m-0 text-[17px] font-bold tracking-tight">When</h2>
      <div className="flex flex-col gap-2" role="radiogroup" aria-label="When to post">
        {OPTIONS.map(({ value, label, note, icon: Icon }) => {
          const on = p.when === value;
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => p.onWhen(value)}
              className={cn(
                "flex items-center gap-3 rounded-ob-md border px-3.5 py-3 text-left transition-colors",
                focusRing,
                on ? "border-ob-primary bg-ob-primary-soft" : "border-ob-line hover:border-ob-line-strong"
              )}
            >
              <span className={cn("grid size-9 shrink-0 place-items-center rounded-ob", on ? "bg-ob-primary text-ob-on-primary" : "bg-ob-sunken text-ob-muted")}>
                <Icon size={16} />
              </span>
              <span className="flex flex-col">
                <span className="text-sm font-bold text-ob-ink">{label}</span>
                <span className="text-xs text-ob-muted">{note}</span>
              </span>
            </button>
          );
        })}
      </div>

      {p.when === "schedule" && (
        <div className="grid grid-cols-[1fr_130px] gap-2">
          <DatePicker aria-label="Day" value={p.date} onChange={p.onDate} min={today()} />
          <TimePicker value={p.time} onChange={p.onTime} />
        </div>
      )}

      <div className="flex flex-col gap-1.5 rounded-ob-md bg-ob-sunken px-3.5 py-3 text-[13px] text-ob-ink-soft">
        <span>
          <strong className="text-ob-ink">{p.accountCount}</strong> account{p.accountCount === 1 ? "" : "s"} selected
        </span>
        {p.when === "schedule" && p.scheduledAt && !inPast && (
          <span>
            Goes out <strong className="text-ob-ink">{dayLabel(p.scheduledAt)} at {timeOfDay(p.scheduledAt)}</strong> ({relative(p.scheduledAt)})
          </span>
        )}
        {inPast && <span className="font-semibold text-ob-danger">That time has passed. Pick a later one.</span>}
        {p.missingCaptions > 0 && p.when !== "draft" && (
          <span className="text-ob-warn">
            {p.missingCaptions} platform{p.missingCaptions === 1 ? " has" : "s have"} no caption yet
          </span>
        )}
      </div>

      <button type="button" className={cn(button(), "w-full")} onClick={p.onSubmit} disabled={p.busy || blocked}>
        {p.busy ? <Loader2 size={16} className="animate-spin" /> : p.when === "now" ? <Send size={16} /> : p.when === "schedule" ? <Clock size={16} /> : <FileText size={16} />}
        {cta}
      </button>
      {p.error && <Alert tone="error">{p.error}</Alert>}
    </section>
  );
}
