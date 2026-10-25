import { Check, ExternalLink, Loader2, X } from "lucide-react";
import { platformMeta } from "@/config/platforms";
import type { PostTarget } from "@/core/posts";
import { cn } from "@/lib/utils";
import { dayLabel, timeOfDay, TARGET_STATUS } from "../../lib/format";
import { PlatformMark } from "../PlatformMark";

const STEPS = ["Queued", "Sending", "Live"] as const;

/** How far a target got: 0 queued, 1 sending, 2 live. A failure stops at the step it reached. */
function reached(t: PostTarget): number {
  if (t.status === "published") return 2;
  if (t.status === "sending") return 1;
  if (t.status === "failed") return t.provider_ref ? 1 : 0;
  return 0;
}

/** One account's journey: queued → sending → live, or where it failed and why. */
export function TargetTimeline({ target }: { target: PostTarget }) {
  const step = reached(target);
  const failed = target.status === "failed";
  const meta = platformMeta(target.platform);

  return (
    <li className="flex flex-col gap-3.5 rounded-ob-md border border-ob-line bg-ob-surface p-4">
      <div className="flex items-center gap-3">
        <PlatformMark platform={target.platform} size="md" />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-bold text-ob-ink">{target.account_name}</span>
          <span className="text-xs text-ob-muted">
            {meta.label} · {TARGET_STATUS[target.status].label}
            {target.published_at && ` · ${dayLabel(new Date(target.published_at))} ${timeOfDay(new Date(target.published_at))}`}
          </span>
        </div>
        {target.url && (
          <a href={target.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-ob-primary hover:underline">
            View live <ExternalLink size={13} />
          </a>
        )}
      </div>

      <ol className="m-0 flex list-none items-center p-0">
        {STEPS.map((label, i) => {
          const done = i < step || (i === step && target.status === "published");
          const here = i === step && !done;
          const broke = failed && here;
          return (
            <li key={label} className={cn("flex items-center", i < STEPS.length - 1 && "flex-1")}>
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "grid size-6 place-items-center rounded-full border-2 text-[11px] font-bold",
                    done && "border-ob-success bg-ob-success text-ob-on-primary",
                    broke && "border-ob-danger bg-ob-danger text-ob-on-primary",
                    here && !broke && "border-ob-primary text-ob-primary",
                    !done && !here && "border-ob-line text-ob-faint"
                  )}
                >
                  {done ? <Check size={13} strokeWidth={3} /> : broke ? <X size={13} strokeWidth={3} /> : here && i === 1 ? <Loader2 size={12} className="animate-spin" /> : i + 1}
                </span>
                <span className={cn("text-xs font-semibold", done ? "text-ob-ink" : broke ? "text-ob-danger" : here ? "text-ob-primary" : "text-ob-faint")}>
                  {broke ? "Failed" : label}
                </span>
              </span>
              {i < STEPS.length - 1 && <span className={cn("mx-2.5 h-0.5 flex-1 rounded-full", i < step ? "bg-ob-success" : "bg-ob-line")} />}
            </li>
          );
        })}
      </ol>

      {failed && target.error && <p className="m-0 rounded-ob bg-ob-danger-soft px-3 py-2 text-[13px] text-ob-danger">{target.error}</p>}
      {target.caption && (
        <details className="group text-[13px]">
          <summary className="cursor-pointer select-none font-semibold text-ob-muted hover:text-ob-ink">Caption</summary>
          <p className="m-0 mt-2 whitespace-pre-wrap text-ob-ink-soft">{target.caption}</p>
        </details>
      )}
    </li>
  );
}
