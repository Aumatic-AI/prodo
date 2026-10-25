import { CalendarClock, CheckCircle2, FilePen, TriangleAlert, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { isUpcoming, postDate, type PostRow } from "../lib/format";

const WEEK_MS = 7 * 86_400_000;

function Stat({ icon: Icon, label, value, note, tone }: { icon: LucideIcon; label: string; value: number; note: string; tone: string }) {
  return (
    <div className="flex items-center gap-3.5 rounded-ob-lg border border-ob-line bg-ob-surface p-4 shadow-ob-xs">
      <span className={cn("grid size-11 shrink-0 place-items-center rounded-ob-md", tone)}>
        <Icon size={20} aria-hidden="true" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-[24px] font-extrabold leading-none tracking-tight tabular-nums text-ob-ink">{value}</span>
        <span className="mt-1 truncate text-[13px] font-semibold text-ob-ink-soft">{label}</span>
        <span className="truncate text-xs text-ob-muted">{note}</span>
      </div>
    </div>
  );
}

/** Four numbers at the top of the Posts page. */
export function PostsStats({ posts }: { posts: PostRow[] }) {
  const now = Date.now();
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const nextWeek = posts.filter((p) => isUpcoming(p) && postDate(p).getTime() - now < WEEK_MS).length;
  const published = posts.filter((p) => (p.status === "published" || p.status === "partial") && postDate(p).getTime() >= monthStart).length;
  const drafts = posts.filter((p) => p.status === "draft").length;
  const failed = posts.filter((p) => p.status === "failed" || p.post_targets.some((t) => t.status === "failed")).length;

  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <Stat icon={CalendarClock} label="Scheduled" value={nextWeek} note="In the next 7 days" tone="bg-ob-primary-soft text-ob-primary" />
      <Stat icon={CheckCircle2} label="Published" value={published} note="This month" tone="bg-ob-success-soft text-ob-success" />
      <Stat icon={FilePen} label="Drafts" value={drafts} note="Waiting to be sent" tone="bg-ob-sunken text-ob-ink-soft" />
      <Stat icon={TriangleAlert} label="Need attention" value={failed} note="Failed on an account" tone="bg-ob-danger-soft text-ob-danger" />
    </div>
  );
}
