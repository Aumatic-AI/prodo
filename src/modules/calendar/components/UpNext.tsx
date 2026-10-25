import Link from "next/link";
import { Card } from "@/components/kit/Card";
import { cn } from "@/lib/utils";
import { formatDay, formatTime } from "../lib/dates";
import { statusOf, TONE_DOT } from "../lib/entries";
import type { Entry } from "../lib/types";
import { EntryThumb } from "./EntryThumb";
import { PlatformIcons } from "./PlatformIcons";

/** The next five things going out. */
export function UpNext({ entries, now }: { entries: Entry[]; now: string }) {
  const next = entries.filter((e) => e.at >= now && !(e.kind === "post" && ["published", "failed", "draft"].includes(e.status))).slice(0, 5);
  return (
    <Card title="Up next" bodyClassName="flex flex-col gap-1">
      {!next.length && <p className="m-0 text-[13px] text-ob-muted">Nothing upcoming in this range.</p>}
      {next.map((e) => {
        const status = statusOf(e);
        return (
          <Link key={`${e.kind}-${e.id}`} href={e.href} className="flex items-center gap-3 rounded-ob-md px-2 py-2 transition-colors hover:bg-ob-sunken">
            <EntryThumb entry={e} className="size-9 rounded-ob" />
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-semibold">{e.title}</span>
              <span className="flex items-center gap-1.5 text-xs text-ob-muted">
                {formatDay(e.day, { weekday: "short", day: "numeric", month: "short" })} · {formatTime(e.time)}
                <PlatformIcons platforms={e.platforms.map((p) => p.platform)} size={11} />
              </span>
            </span>
            <span className={cn("size-2 shrink-0 rounded-full", TONE_DOT[status.tone])} title={status.label} />
          </Link>
        );
      })}
    </Card>
  );
}
