"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@base-ui/react/dialog";
import { ChevronLeft, ChevronRight, Download, X } from "lucide-react";
import { downloadFile } from "@/lib/download";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  /** Every image that can be shown (a carousel's slides, or one picture) */
  images: string[];
  /** Which one is open; null = closed */
  index: number | null;
  onIndexChange: (index: number | null) => void;
  /** What the picture is, for screen readers */
  label?: string;
  /** Name of the downloaded file, without the extension */
  fileName?: string;
}

const round = "absolute flex h-11 w-11 items-center justify-center rounded-full bg-ob-dark/60 text-ob-on-dark transition-colors hover:bg-ob-dark/80";

/** A picture as big as the screen allows, inside the app. Click outside it, press Escape or use the close button to leave. */
export function ImageLightbox({ images, index, onIndexChange, label = "Picture", fileName = "prodo-ad" }: ImageLightboxProps) {
  const open = index !== null && !!images[index];
  const many = images.length > 1;
  const [saving, setSaving] = useState(false);

  async function download() {
    setSaving(true);
    await downloadFile(images[index as number], `${fileName}${many ? `-${(index as number) + 1}` : ""}`);
    setSaving(false);
  }

  // Arrow keys move between pictures
  useEffect(() => {
    if (!open || !many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndexChange(((index as number) + 1) % images.length);
      if (e.key === "ArrowLeft") onIndexChange(((index as number) - 1 + images.length) % images.length);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, many, index, images.length, onIndexChange]);

  return (
    <Dialog.Root open={open} onOpenChange={(next) => !next && onIndexChange(null)}>
      <Dialog.Portal>
        {/* forceRender: inside another dialog (a post's detail) Base UI would skip the backdrop, and the page behind would show */}
        <Dialog.Backdrop forceRender className="fixed inset-0 z-50 bg-ob-dark/85 backdrop-blur-md transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup
          // The whole screen is the popup, so a click on the empty area around the picture closes it
          className="fixed inset-0 z-50 flex items-center justify-center p-3 outline-none transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0"
          onClick={(e) => e.target === e.currentTarget && onIndexChange(null)}
        >
          <Dialog.Title className="sr-only">{label}</Dialog.Title>
          {open && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={images[index as number]} alt={label} className="max-h-full max-w-full rounded-ob-md object-contain shadow-ob-md" onClick={(e) => e.stopPropagation()} />
          )}
          <button type="button" className={cn(round, "right-[68px] top-4")} aria-label="Download" title="Download" disabled={saving} onClick={download}>
            <Download size={19} />
          </button>
          <Dialog.Close className={cn(round, "right-4 top-4")} aria-label="Close">
            <X size={20} />
          </Dialog.Close>
          {many && (
            <>
              <button type="button" className={cn(round, "left-4 top-1/2 -translate-y-1/2")} aria-label="Previous picture" onClick={() => onIndexChange(((index as number) - 1 + images.length) % images.length)}>
                <ChevronLeft size={22} />
              </button>
              <button type="button" className={cn(round, "right-4 top-1/2 -translate-y-1/2")} aria-label="Next picture" onClick={() => onIndexChange(((index as number) + 1) % images.length)}>
                <ChevronRight size={22} />
              </button>
              <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-ob-dark/60 px-3 py-1 text-xs font-bold text-ob-on-dark">
                {(index as number) + 1} / {images.length}
              </span>
            </>
          )}
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
