import { FlaskConical } from "lucide-react";
import { focusRing } from "@/components/kit/styles";
import { LABELS } from "@/core/creative/brief";
import { styleName } from "@/core/content/styles";
import type { PlanItemView } from "@/core/plans/types";
import { cn } from "@/lib/utils";
import { PlatformMark } from "@/modules/posts/components/PlatformMark";
import { slotTime } from "../lib/time";
import { SlotThumb } from "./SlotThumb";
import { StatusPill } from "./StatusPill";

/** One planned post as a wide row: the phone layout of the board. */
export function SlotRow({ item, timezone, onOpen }: { item: PlanItemView; timezone: string; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex w-full min-w-0 gap-3 rounded-ob-lg border border-ob-line bg-ob-surface p-2.5 text-left shadow-ob-xs transition-colors active:bg-ob-sunken",
        item.status === "needs_review" && "border-ob-warn/40",
        item.status === "rejected" && "opacity-60",
        focusRing
      )}
    >
      <SlotThumb item={item} className="aspect-[4/5] w-20 shrink-0 overflow-hidden rounded-ob-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1.5 py-0.5">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <time className="text-[13px] font-bold tabular-nums">{slotTime(item.slot_at, timezone)}</time>
          <span className="text-[11.5px] font-semibold text-ob-muted">
            {[LABELS.format[item.format], styleName(item.style)].filter(Boolean).join(" · ")}
          </span>
          {item.is_experiment && <FlaskConical size={12} className="text-ob-primary" aria-label="Experiment" />}
        </div>
        <p className="m-0 line-clamp-2 text-[13.5px] font-semibold leading-snug">{item.hook_text ?? item.angle ?? "Planned post"}</p>
        <div className="mt-auto flex min-w-0 items-center justify-between gap-2">
          <div className="flex shrink-0 -space-x-1.5">
            {item.platforms.map((p) => (
              <span key={p} className="rounded-ob ring-2 ring-ob-surface">
                <PlatformMark platform={p} />
              </span>
            ))}
          </div>
          <StatusPill status={item.status} className="shrink" />
        </div>
      </div>
    </button>
  );
}
