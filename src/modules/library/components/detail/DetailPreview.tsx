"use client";

import { Loader2 } from "lucide-react";
import { publicUrl } from "@/components/kit/MediaUploader";
import { Skeleton } from "@/components/kit/Skeleton";
import type { MediaDetail, MediaListItem } from "../../types";
import { SlideStrip } from "./SlideStrip";

/** The big preview: image, video with controls, carousel slides or the text itself. */
export function DetailPreview({ media, detail, loading }: { media: MediaListItem; detail?: MediaDetail; loading: boolean }) {
  const url = media.storage_key ? publicUrl(media.storage_key) : null;

  if (media.type === "text") {
    return (
      <div className="rounded-ob-lg border border-ob-line bg-ob-surface p-6 shadow-ob-xs">
        <p className="m-0 whitespace-pre-wrap text-[15px] leading-relaxed text-ob-ink-soft">{media.content || media.idea}</p>
      </div>
    );
  }

  if (media.type === "carousel") {
    const slides = detail?.files.filter((f) => f.role === "slide") ?? [];
    if (loading) return <Skeleton className="aspect-[4/5] w-full max-w-[360px]" />;
    if (slides.length) return <SlideStrip slides={slides} />;
  }

  if (!url) {
    return (
      <div className="grid aspect-square place-items-center rounded-ob-lg bg-ob-sunken text-ob-muted">
        <Loader2 className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="grid place-items-center rounded-ob-lg bg-[repeating-conic-gradient(var(--color-ob-sunken)_0_25%,var(--color-ob-surface)_0_50%)] bg-[length:20px_20px] p-3">
      {media.type === "video" ? (
        <video src={url} controls playsInline className="max-h-[62vh] max-w-full rounded-ob-md shadow-ob-md" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt={media.idea || ""} className="max-h-[62vh] max-w-full rounded-ob-md object-contain shadow-ob-md" />
      )}
    </div>
  );
}
