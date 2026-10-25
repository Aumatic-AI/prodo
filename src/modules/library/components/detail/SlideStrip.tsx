"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { button, focusRing } from "@/components/kit/styles";
import { publicUrl } from "@/components/kit/MediaUploader";
import type { MediaFile } from "../../types";

/** Carousel slides in a strip you can swipe or scroll with the arrows. */
export function SlideStrip({ slides }: { slides: MediaFile[] }) {
  const stripRef = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);

  function go(next: number) {
    const strip = stripRef.current;
    const target = Math.max(0, Math.min(slides.length - 1, next));
    const slide = strip?.children[target] as HTMLElement | undefined;
    if (strip && slide) strip.scrollTo({ left: slide.offsetLeft - strip.offsetLeft, behavior: "smooth" });
    setIndex(target);
  }

  function onScroll() {
    const strip = stripRef.current;
    const first = strip?.children[0] as HTMLElement | undefined;
    if (!strip || !first) return;
    setIndex(Math.round(strip.scrollLeft / (first.offsetWidth + 12)));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <div ref={stripRef} onScroll={onScroll} className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth pb-1 [scrollbar-width:none]">
          {slides.map((s, i) => (
            <figure key={s.storage_key} className="m-0 w-[min(78%,360px)] shrink-0 snap-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={publicUrl(s.storage_key)} alt={`Slide ${i + 1}`} className="aspect-[4/5] w-full rounded-ob-md border border-ob-line object-cover shadow-ob-sm" />
            </figure>
          ))}
        </div>
        {slides.length > 1 && (
          <>
            <button type="button" aria-label="Previous slide" disabled={index === 0} onClick={() => go(index - 1)} className={cn(button({ variant: "secondary", size: "icon" }), "absolute left-2 top-1/2 -translate-y-1/2 rounded-full shadow-ob-md")}>
              <ChevronLeft size={18} />
            </button>
            <button type="button" aria-label="Next slide" disabled={index >= slides.length - 1} onClick={() => go(index + 1)} className={cn(button({ variant: "secondary", size: "icon" }), "absolute right-2 top-1/2 -translate-y-1/2 rounded-full shadow-ob-md")}>
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>
      <div className="flex items-center justify-center gap-1.5" aria-label={`Slide ${index + 1} of ${slides.length}`}>
        {slides.map((s, i) => (
          <button
            key={s.storage_key}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => go(i)}
            className={cn("h-1.5 rounded-full transition-all duration-200", focusRing, i === index ? "w-6 bg-ob-primary" : "w-1.5 bg-ob-line-strong hover:bg-ob-muted")}
          />
        ))}
      </div>
    </div>
  );
}
