import { platformMeta } from "@/config/platforms";
import type { TargetStatus } from "@/core/posts";
import { cn } from "@/lib/utils";
import { TARGET_STATUS } from "../lib/format";

const SIZES = { sm: { box: "size-7", icon: 14 }, md: { box: "size-9", icon: 17 }, lg: { box: "size-11", icon: 20 } };

/** A platform's icon on its brand colour, with an optional status dot in the corner. */
export function PlatformMark({ platform, status, size = "sm", title }: { platform: string; status?: TargetStatus; size?: keyof typeof SIZES; title?: string }) {
  const meta = platformMeta(platform);
  const Icon = meta.icon;
  const s = SIZES[size];
  return (
    <span className={cn("relative grid shrink-0 place-items-center rounded-ob text-ob-on-dark", s.box)} style={{ backgroundColor: meta.color }} title={title ?? meta.label}>
      <Icon size={s.icon} aria-hidden="true" />
      <span className="sr-only">{meta.label}</span>
      {status && (
        <span className={cn("absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full ring-2 ring-ob-surface", TARGET_STATUS[status].dot)} aria-label={TARGET_STATUS[status].label} />
      )}
    </span>
  );
}
