"use client";

import { useRef } from "react";
import { Play } from "lucide-react";
import { publicUrl } from "@/components/kit/MediaUploader";
import type { MediaListItem } from "../../types";

/** The visual part of a ready card: image, video (plays muted on hover), carousel cover or text. */
export function MediaCover({ media }: { media: MediaListItem }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = media.storage_key ? publicUrl(media.storage_key) : null;

  if (media.type === "text" || !url) {
    return (
      <div className="flex size-full flex-col justify-between bg-[linear-gradient(160deg,var(--color-ob-primary-soft),var(--color-ob-surface)_70%)] p-5">
        <span className="font-serif text-5xl leading-none text-ob-primary/40" aria-hidden="true">
          &ldquo;
        </span>
        <p className="m-0 line-clamp-6 text-[14px] font-medium leading-relaxed text-ob-ink-soft">{media.content || media.idea || "Text post"}</p>
      </div>
    );
  }

  if (media.type === "video") {
    return (
      <div
        className="relative size-full"
        onMouseEnter={() => videoRef.current?.play().catch(() => undefined)}
        onMouseLeave={() => {
          const v = videoRef.current;
          if (!v) return;
          v.pause();
          v.currentTime = 0.5;
        }}
      >
        <video ref={videoRef} src={`${url}#t=0.5`} muted loop playsInline preload="metadata" className="size-full object-cover" />
        <span className="pointer-events-none absolute bottom-3 left-3 grid size-8 place-items-center rounded-full bg-ob-dark/65 text-ob-on-dark backdrop-blur-sm transition-opacity group-hover:opacity-0">
          <Play size={13} fill="currentColor" className="translate-x-px" />
        </span>
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={media.idea || ""} loading="lazy" className="size-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />;
}
