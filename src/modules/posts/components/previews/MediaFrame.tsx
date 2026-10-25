"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PreviewMediaType } from "./types";

interface MediaFrameProps {
  urls: string[];
  type?: PreviewMediaType;
  /** CSS aspect ratio, e.g. "4 / 5" */
  aspect: string;
  /** Where carousel dots go: under the media (Instagram) or on it */
  dots?: "below" | "inside";
  className?: string;
}

/** The media area of a preview: a picture, a video, or a swipeable carousel with dots. */
export function MediaFrame({ urls, type, aspect, dots = "inside", className }: MediaFrameProps) {
  const [index, setIndex] = useState(0);
  const count = urls.length;
  const current = Math.min(index, Math.max(0, count - 1));
  const many = type === "carousel" && count > 1;

  if (!count) {
    return <div className={cn("grid place-items-center bg-neutral-100 text-xs text-neutral-400", className)} style={{ aspectRatio: aspect }}>No media</div>;
  }

  return (
    <div className={className}>
      <div className="group/frame relative overflow-hidden bg-neutral-100" style={{ aspectRatio: aspect }}>
        <div className="flex h-full transition-transform duration-300 ease-out" style={{ transform: `translateX(-${current * 100}%)` }}>
          {urls.map((url, i) =>
            type === "video" ? (
              <video key={url} src={url} controls playsInline className="size-full shrink-0 bg-black object-contain" />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={`${url}-${i}`} src={url} alt="" className="size-full shrink-0 object-cover" />
            )
          )}
        </div>
        {many && (
          <>
            <span className="absolute right-2.5 top-2.5 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-semibold text-white">
              {current + 1}/{count}
            </span>
            {current > 0 && (
              <button
                type="button"
                aria-label="Previous slide"
                onClick={() => setIndex(current - 1)}
                className="absolute left-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-800 shadow opacity-0 transition-opacity group-hover/frame:opacity-100"
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {current < count - 1 && (
              <button
                type="button"
                aria-label="Next slide"
                onClick={() => setIndex(current + 1)}
                className="absolute right-2 top-1/2 grid size-7 -translate-y-1/2 place-items-center rounded-full bg-white/90 text-neutral-800 shadow opacity-0 transition-opacity group-hover/frame:opacity-100"
              >
                <ChevronRight size={16} />
              </button>
            )}
            {dots === "inside" && <Dots count={count} current={current} onPick={setIndex} className="absolute inset-x-0 bottom-2.5" light />}
          </>
        )}
      </div>
      {many && dots === "below" && <Dots count={count} current={current} onPick={setIndex} className="pt-2.5" />}
    </div>
  );
}

function Dots({ count, current, onPick, className, light }: { count: number; current: number; onPick: (i: number) => void; className?: string; light?: boolean }) {
  return (
    <div className={cn("flex justify-center gap-1", className)}>
      {Array.from({ length: count }, (_, i) => (
        <button
          key={i}
          type="button"
          aria-label={`Slide ${i + 1}`}
          onClick={() => onPick(i)}
          className={cn(
            "size-1.5 rounded-full transition-all",
            i === current ? (light ? "w-3 bg-white" : "bg-sky-500") : light ? "bg-white/55" : "bg-neutral-300"
          )}
        />
      ))}
    </div>
  );
}
