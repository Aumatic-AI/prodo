import { FileText, GalleryHorizontalEnd, ImageIcon, Play, Video } from "lucide-react";
import { publicUrl } from "@/components/kit/MediaUploader";
import { cn } from "@/lib/utils";
import type { Entry } from "../lib/types";

/** Small square preview of an entry's media; an icon while there's no file yet. */
export function EntryThumb({ entry, className }: { entry: Entry; className?: string }) {
  const base = cn("relative grid shrink-0 place-items-center overflow-hidden rounded-ob bg-ob-sunken text-ob-muted", className);
  const Icon = entry.mediaType === "video" ? Video : entry.mediaType === "carousel" ? GalleryHorizontalEnd : entry.mediaType === "text" ? FileText : ImageIcon;

  if (!entry.thumbKey || entry.mediaType === "text") {
    return (
      <span className={base} aria-hidden="true">
        <Icon size={14} />
      </span>
    );
  }
  return (
    <span className={base} aria-hidden="true">
      {entry.mediaType === "video" ? (
        <>
          <video src={publicUrl(entry.thumbKey)} muted playsInline preload="metadata" className="size-full object-cover" />
          <Play size={10} className="absolute fill-ob-on-dark text-ob-on-dark drop-shadow" />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={publicUrl(entry.thumbKey)} alt="" loading="lazy" className="size-full object-cover" />
      )}
    </span>
  );
}
