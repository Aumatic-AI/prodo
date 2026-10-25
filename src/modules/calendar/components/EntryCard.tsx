import Link from "next/link";
import { ArrowUpRight, Bot } from "lucide-react";
import { Badge } from "@/components/kit/Badge";
import { LABELS } from "@/core/creative/brief";
import { cn } from "@/lib/utils";
import { formatTime } from "../lib/dates";
import { statusOf } from "../lib/entries";
import type { Entry } from "../lib/types";
import { EntryThumb } from "./EntryThumb";
import { PlatformIcons } from "./PlatformIcons";

/** Full card for the agenda and the week view. */
export function EntryCard({ entry, compact = false }: { entry: Entry; compact?: boolean }) {
  const status = statusOf(entry);
  const planned = entry.kind === "item";
  return (
    <Link
      href={entry.href}
      className={cn(
        "group flex gap-3 rounded-ob-md border p-2.5 transition-all duration-200 hover:-translate-y-0.5 hover:border-ob-line-strong hover:shadow-ob-sm",
        planned ? "border-dashed border-ob-line-strong bg-ob-bg" : "border-ob-line bg-ob-surface",
        compact && "flex-col gap-2"
      )}
    >
      <EntryThumb entry={entry} className={compact ? "aspect-[4/3] w-full rounded-ob-md" : "size-14 rounded-ob-md"} />
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-2 text-xs font-semibold text-ob-muted">
          <span className="tabular-nums text-ob-ink">{formatTime(entry.time)}</span>
          <PlatformIcons platforms={entry.platforms.map((p) => p.platform)} size={12} />
          <ArrowUpRight size={13} className="ml-auto opacity-0 transition-opacity group-hover:opacity-100" />
        </span>
        <span className={cn("text-[13.5px] font-semibold leading-snug text-ob-ink", compact ? "line-clamp-3" : "line-clamp-2")}>{entry.title}</span>
        <span className="flex flex-wrap items-center gap-1.5">
          <Badge tone={status.tone} size="sm">
            <span className="size-1.5 rounded-full bg-current" aria-hidden="true" />
            {status.label}
          </Badge>
          {entry.kind === "item" && (
            <Badge size="sm">{LABELS.format[entry.format]}</Badge>
          )}
          {entry.kind === "post" && entry.byAgent && (
            <Badge tone="primary" size="sm">
              <Bot size={11} /> By Prodo
            </Badge>
          )}
        </span>
      </span>
    </Link>
  );
}
