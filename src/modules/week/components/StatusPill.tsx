import { Loader2 } from "lucide-react";
import { Badge } from "@/components/kit/Badge";
import type { ItemStatus } from "@/core/plans/types";
import { cn } from "@/lib/utils";
import { ITEM_STATUS } from "../lib/status";

/**
 * A slot's status. Never wider than its space: the label truncates, and with `compact` it
 * hides entirely in narrow cards (container query on the nearest @container), leaving the icon.
 */
export function StatusPill({ status, size = "sm", compact = false, className }: { status: ItemStatus; size?: "sm" | "md"; compact?: boolean; className?: string }) {
  const s = ITEM_STATUS[status];
  const Icon = s.working ? Loader2 : s.icon;
  return (
    <Badge tone={s.tone} size={size} className={cn("min-w-0 max-w-full", className)}>
      <Icon size={size === "sm" ? 11 : 13} className={cn("shrink-0", s.working && "animate-spin")} aria-hidden="true" />
      <span className={cn("truncate", compact && "hidden @min-[11.5rem]:inline")} title={s.label}>
        {s.label}
      </span>
      {compact && <span className="sr-only @min-[11.5rem]:hidden">{s.label}</span>}
    </Badge>
  );
}
