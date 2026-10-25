import { FileText, GalleryHorizontal, Play } from "lucide-react";
import { publicUrl } from "@/components/kit/MediaUploader";
import type { PostMediaSummary } from "@/core/posts";
import { cn } from "@/lib/utils";

/** Square preview of a post's media: image, video frame, carousel cover or text snippet. */
export function PostThumb({ media, className }: { media: PostMediaSummary | null; className?: string }) {
  const url = media?.storage_key ? publicUrl(media.storage_key) : null;
  const type = media?.type ?? "text";

  return (
    <div className={cn("relative shrink-0 overflow-hidden rounded-ob-md bg-ob-sunken", className)}>
      {url && type === "video" ? (
        <video src={`${url}#t=0.5`} muted playsInline preload="metadata" className="size-full object-cover" />
      ) : url && type !== "text" ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <div className="flex size-full flex-col gap-1 bg-linear-to-br from-ob-primary-soft to-ob-surface p-2">
          <FileText size={14} className="shrink-0 text-ob-primary" />
          <p className="m-0 line-clamp-3 text-[9.5px] leading-tight text-ob-ink-soft">{media?.content || media?.idea}</p>
        </div>
      )}
      {type === "video" && url && (
        <span className="absolute bottom-1.5 left-1.5 grid size-5 place-items-center rounded-full bg-ob-dark/70 text-ob-on-dark">
          <Play size={10} fill="currentColor" />
        </span>
      )}
      {type === "carousel" && (
        <span className="absolute right-1.5 top-1.5 grid size-5 place-items-center rounded-full bg-ob-dark/70 text-ob-on-dark">
          <GalleryHorizontal size={11} />
        </span>
      )}
    </div>
  );
}
