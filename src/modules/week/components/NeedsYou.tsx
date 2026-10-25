import { Check, Inbox, RotateCcw } from "lucide-react";
import { Card } from "@/components/kit/Card";
import { button } from "@/components/kit/styles";
import type { PlanItemView } from "@/core/plans/types";
import { cn } from "@/lib/utils";
import { useItemAction } from "../hooks/usePlan";
import { slotWhen } from "../lib/time";
import { SlotThumb } from "./SlotThumb";
import { StatusPill } from "./StatusPill";

const rank = (i: PlanItemView) => (i.status === "failed" ? 0 : i.status === "needs_review" ? 1 : 2);

/** Approval inbox: posts waiting for the client, failed ones and those that need a look first. */
export function NeedsYou({ items, timezone, onOpen }: { items: PlanItemView[]; timezone: string; onOpen: (id: string) => void }) {
  const action = useItemAction();
  const waiting = items
    .filter((i) => i.status === "failed" || i.status === "needs_review" || i.status === "ready" || (i.status === "approved" && i.error))
    // Problems first (failed, then needs a look), then by time
    .sort((a, b) => rank(a) - rank(b) || a.slot_at.localeCompare(b.slot_at));

  return (
    <Card
      title={
        <span className="flex items-center gap-2">
          Needs you
          {waiting.length > 0 && <span className="grid min-w-6 place-items-center rounded-full bg-ob-primary px-1.5 text-xs font-bold text-ob-on-primary">{waiting.length}</span>}
        </span>
      }
      description="Posts waiting for your yes, and any that failed."
    >
      {waiting.length ? (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {waiting.map((item) => (
            <li key={item.id} className="group flex items-center gap-3 rounded-ob-md p-1.5 transition-colors hover:bg-ob-sunken">
              <button type="button" onClick={() => onOpen(item.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                <SlotThumb item={item} className="size-12 shrink-0 rounded-ob" />
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="truncate text-[13px] font-semibold">{item.hook_text ?? item.angle}</span>
                  <span className="flex items-center gap-2 text-[11.5px] text-ob-muted">
                    {slotWhen(item.slot_at, timezone)}
                    <StatusPill status={item.status} />
                  </span>
                  {item.error && <span className="truncate text-[11.5px] text-ob-danger">{item.error}</span>}
                </span>
              </button>
              {item.status === "failed" && (
                <button
                  type="button"
                  aria-label="Try again"
                  title="Try again"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: item.id, action: "regenerate" })}
                  className={cn(button({ variant: "secondary", size: "xs" }), "shrink-0 hover:border-ob-primary hover:text-ob-primary")}
                >
                  <RotateCcw size={13} /> Try again
                </button>
              )}
              {item.status === "ready" && (
                <button
                  type="button"
                  aria-label="Approve"
                  title="Approve"
                  disabled={action.isPending}
                  onClick={() => action.mutate({ id: item.id, action: "approve" })}
                  className={cn(button({ variant: "secondary", size: "iconSm" }), "hover:border-ob-success hover:text-ob-success")}
                >
                  <Check size={15} />
                </button>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-3 rounded-ob-md bg-ob-sunken px-4 py-3.5 text-sm text-ob-muted">
          <Inbox size={18} className="shrink-0 text-ob-faint" />
          All caught up. New posts appear here when they pass QA.
        </div>
      )}
      {action.error && <p className="m-0 mt-3 text-sm text-ob-danger">{action.error.message}</p>}
    </Card>
  );
}
