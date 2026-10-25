import { FileText, GalleryHorizontal, Play } from "lucide-react";
import { publicUrl } from "@/components/kit/MediaUploader";
import type { PlanItemView } from "@/core/plans/types";
import { cn } from "@/lib/utils";
import { ITEM_STATUS } from "../lib/status";

/** The slot's finished media, or a lively placeholder while the agents work on it. */
export function SlotThumb({ item, className }: { item: PlanItemView; className?: string }) {
  const media = item.media;
  const url = media?.storage_key && media.status === "ready" ? publicUrl(media.storage_key) : null;
  const working = ITEM_STATUS[item.status].working;

  if (url && media!.type === "video") {
    return (
      <div className={cn("relative overflow-hidden bg-ob-dark", className)}>
        <video src={`${url}#t=0.8`} muted playsInline preload="metadata" className="size-full object-cover" />
        <span className="absolute bottom-2 left-2 grid size-6 place-items-center rounded-full bg-ob-dark/70 text-ob-on-dark">
          <Play size={11} fill="currentColor" />
        </span>
      </div>
    );
  }
  if (url) {
    return (
      <div className={cn("relative overflow-hidden bg-ob-sunken", className)}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={url} alt="" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        {media!.type === "carousel" && (
          <span className="absolute right-2 top-2 grid size-6 place-items-center rounded-full bg-ob-dark/70 text-ob-on-dark">
            <GalleryHorizontal size={12} />
          </span>
        )}
      </div>
    );
  }
  if (item.format === "text" && item.brief) {
    return (
      <div className={cn("flex flex-col gap-2 bg-linear-to-br from-ob-primary-soft via-ob-surface to-ob-surface p-3.5", className)}>
        <FileText size={15} className="text-ob-primary" />
        <p className="m-0 line-clamp-6 text-[12px] leading-snug text-ob-ink-soft">{Object.values(item.captions ?? {})[0] ?? item.brief.message}</p>
      </div>
    );
  }
  const Icon = ITEM_STATUS[item.status].icon;
  return (
    <div
      className={cn(
        "relative grid place-items-center overflow-hidden bg-linear-to-br from-ob-primary-soft via-ob-surface to-ob-sunken",
        working && "after:absolute after:inset-0 after:animate-pulse after:bg-ob-surface/40",
        className
      )}
    >
      <div className="relative z-10 flex flex-col items-center gap-2 px-3 text-center">
        <span className={cn("grid size-10 place-items-center rounded-full bg-ob-surface text-ob-primary shadow-ob-sm", working && "animate-bounce [animation-duration:2s]")}>
          <Icon size={18} />
        </span>
        <span className="text-[11.5px] font-semibold text-ob-muted">{ITEM_STATUS[item.status].label}…</span>
      </div>
    </div>
  );
}
