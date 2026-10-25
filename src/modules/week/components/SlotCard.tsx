import { FlaskConical } from "lucide-react";
import { Badge } from "@/components/kit/Badge";
import { focusRing } from "@/components/kit/styles";
import { LABELS } from "@/core/creative/brief";
import type { PlanItemView } from "@/core/plans/types";
import { cn } from "@/lib/utils";
import { PlatformMark } from "@/modules/posts/components/PlatformMark";
import { slotTime } from "../lib/time";
import { SlotThumb } from "./SlotThumb";
import { StatusPill } from "./StatusPill";

/** One planned post on the board: preview, time, platforms, status and what it's about. */
export function SlotCard({ item, timezone, onOpen }: { item: PlanItemView; timezone: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "@container group flex w-full min-w-0 flex-col overflow-hidden rounded-ob-lg border border-ob-line bg-ob-surface text-left shadow-ob-xs",
        "transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-ob-line-strong hover:shadow-ob-md",
        item.status === "needs_review" && "border-ob-warn/40",
        item.status === "rejected" && "opacity-60",
        focusRing
      )}
    >
      <div className="relative">
        <SlotThumb item={item} className="aspect-[4/5] w-full" />
        <div className="absolute left-2 top-2 flex items-center gap-1">
          <Badge tone="dark" size="sm" className="bg-ob-dark/75 backdrop-blur-sm">
            {LABELS.format[item.format]}
          </Badge>
          {item.is_experiment && (
            <span className="grid size-[22px] place-items-center rounded-full bg-ob-surface/90 text-ob-primary shadow-ob-xs" title="Experiment: trying something new">
              <FlaskConical size={12} />
            </span>
          )}
        </div>
        <div className="absolute bottom-2 left-2 flex -space-x-1.5">
          {item.platforms.map((p) => (
            <span key={p} className="rounded-ob ring-2 ring-ob-surface">
              <PlatformMark platform={p} />
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <time className="shrink-0 text-[12.5px] font-bold tabular-nums text-ob-ink">{slotTime(item.slot_at, timezone)}</time>
          {/* In narrow cards only the status icon shows; the label is in the tooltip */}
          <StatusPill status={item.status} compact />
        </div>
        <p className="m-0 line-clamp-2 text-[13px] font-semibold leading-snug text-ob-ink">{item.hook_text ?? item.angle ?? "Planned post"}</p>
        <p className="m-0 truncate text-[11.5px] text-ob-muted">{[item.pillar?.name, item.offering?.name].filter(Boolean).join(" · ") || item.objective}</p>
      </div>
    </button>
  );
}
