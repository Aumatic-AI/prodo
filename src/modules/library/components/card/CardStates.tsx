"use client";

import { AlertTriangle, Loader2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";
import { button } from "@/components/kit/styles";
import { TYPE_META, elapsed } from "../../lib/display";
import { useNow } from "../../hooks/useNow";
import type { MediaListItem } from "../../types";

/** Shimmering placeholder while an agent or job makes the asset. */
export function GeneratingCover({ media }: { media: MediaListItem }) {
  const now = useNow(true);
  return (
    <div className="relative grid size-full place-items-center overflow-hidden bg-ob-primary-soft">
      <div className="absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_30%_20%,var(--color-ob-surface),transparent_60%)] opacity-80" />
      <div className="relative flex flex-col items-center gap-2.5 px-4 text-center">
        <span className="grid size-11 place-items-center rounded-full bg-ob-surface text-ob-primary shadow-ob-sm">
          <Loader2 size={20} className="animate-spin" />
        </span>
        <span className="text-sm font-bold text-ob-primary-ink">{TYPE_META[media.type].making}</span>
        <span className="text-xs font-semibold tabular-nums text-ob-primary">{elapsed(media.created_at, now)}</span>
      </div>
    </div>
  );
}

/** The plain error and a Retry button. */
export function FailedCover({ media, onRetry, retrying }: { media: MediaListItem; onRetry: () => void; retrying: boolean }) {
  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 bg-ob-danger-soft px-5 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-ob-surface text-ob-danger shadow-ob-xs">
        <AlertTriangle size={18} />
      </span>
      <p className="m-0 line-clamp-4 text-[13px] font-medium text-ob-danger">{media.error || "This didn't work. Try again."}</p>
      {media.type !== "text" && (
        <button
          type="button"
          className={cn(button({ variant: "secondary", size: "xs" }), "shadow-ob-xs")}
          disabled={retrying}
          onClick={(e) => {
            e.stopPropagation();
            onRetry();
          }}
        >
          <RotateCcw size={13} className={retrying ? "animate-spin" : undefined} />
          {retrying ? "Retrying…" : "Retry"}
        </button>
      )}
    </div>
  );
}
