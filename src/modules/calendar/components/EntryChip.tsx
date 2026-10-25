import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatTime } from "../lib/dates";
import { statusOf, TONE_DOT } from "../lib/entries";
import type { Entry } from "../lib/types";
import { EntryThumb } from "./EntryThumb";
import { PlatformIcons } from "./PlatformIcons";

/** Compact one-line entry for a month cell. Planned slots are dashed. */
export function EntryChip({ entry }: { entry: Entry }) {
  const status = statusOf(entry);
  const planned = entry.kind === "item";
  return (
    <Link
      href={entry.href}
      onClick={(e) => e.stopPropagation()}
      title={`${formatTime(entry.time)} · ${status.label} · ${entry.title}`}
      className={cn(
        "group/chip flex min-w-0 items-center gap-1.5 rounded-ob border px-1.5 py-1 text-[11.5px] font-semibold transition-all duration-150 hover:-translate-y-px hover:shadow-ob-sm",
        planned ? "border-dashed border-ob-line-strong bg-ob-surface/70 text-ob-muted" : "border-ob-line bg-ob-surface text-ob-ink"
      )}
    >
      <EntryThumb entry={entry} className="size-5 rounded-[6px]" />
      <span className="shrink-0 tabular-nums">{formatTime(entry.time).replace(":00", "")}</span>
      <PlatformIcons platforms={entry.platforms.map((p) => p.platform).slice(0, 2)} size={11} className="shrink-0" />
      <span className="min-w-0 flex-1 truncate font-medium text-ob-muted max-xl:hidden">{entry.title}</span>
      <span className={cn("ml-auto size-1.5 shrink-0 rounded-full", TONE_DOT[status.tone])} aria-label={status.label} />
    </Link>
  );
}
