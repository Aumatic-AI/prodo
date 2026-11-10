"use client";

import { useState } from "react";
import { Library, Link2, Upload as UploadIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Field } from "@/components/kit/Field";
import { TextInput } from "@/components/kit/inputs";
import { MediaUploader } from "@/components/kit/MediaUploader";
import { Pills } from "@/components/kit/choices";
import { Badge } from "@/components/kit/Badge";
import { button, focusRing } from "@/components/kit/styles";
import type { LibraryAd } from "@/core/ad-library";
import type { Upload } from "@/core/onboarding/schemas";
import { AdLibraryPicker, runningFor } from "./AdLibraryPicker";

export type CopySource = "upload" | "link" | "library";

/** Where the video to copy comes from: an upload, a pasted link or an ad picked in the Ad library. */
export interface VideoToCopyValue {
  source: CopySource;
  uploads: Upload[];
  link: string;
  picked: LibraryAd | null;
}

export const EMPTY_VIDEO_TO_COPY: VideoToCopyValue = { source: "upload", uploads: [], link: "", picked: null };

/** What the create-ad route takes: the uploaded file's key, or a link (a picked ad is its Ad Library link). */
export function videoToCopyInput(v: VideoToCopyValue): { referenceVideoKey: string | null; referenceUrl: string | null } {
  if (v.source === "upload") return { referenceVideoKey: v.uploads[0]?.key ?? null, referenceUrl: null };
  if (v.source === "library") return { referenceVideoKey: null, referenceUrl: v.picked?.link ?? null };
  return { referenceVideoKey: null, referenceUrl: v.link.trim().length >= 5 ? v.link.trim() : null };
}

/** Why the video isn't ready yet, or null. */
export function videoToCopyMissing(v: VideoToCopyValue): string | null {
  if (v.source === "upload") return v.uploads.length ? null : "Upload the video to copy";
  if (v.source === "library") return v.picked ? null : "Pick an ad from the Ad library";
  return v.link.trim().length >= 5 ? null : "Paste the video's link";
}

const SOURCES: { value: CopySource; label: string; icon: React.ReactNode }[] = [
  { value: "upload", label: "Upload", icon: <UploadIcon size={15} /> },
  { value: "link", label: "Paste a link", icon: <Link2 size={15} /> },
  { value: "library", label: "Ad library", icon: <Library size={15} /> },
];

/** The "Video to copy" field shared by Create an ad and Media → Create → Copy a video. */
export function VideoToCopy({ value, onChange, id }: { value: VideoToCopyValue; onChange: (v: VideoToCopyValue) => void; id: string }) {
  const [browsing, setBrowsing] = useState(false);
  const set = (patch: Partial<VideoToCopyValue>) => onChange({ ...value, ...patch });

  return (
    <Field label="Video to copy" hint="Everything comes from this video: its scenes, timing, shots, pace, text and sound. Only the product is yours.">
      <div className="flex flex-col gap-3">
        <Pills options={SOURCES} value={value.source} onChange={(source) => set({ source })} label="Where the video comes from" />

        {value.source === "upload" && <MediaUploader purpose="referenceVideo" max={1} value={value.uploads} onChange={(uploads) => set({ uploads })} />}

        {value.source === "link" && (
          <div className="flex flex-col gap-1.5">
            <TextInput id={id} aria-label="Video link" value={value.link} onValueChange={(link) => set({ link })} placeholder="https://www.facebook.com/ads/library/?id=…" />
            <span className="text-[13px] text-ob-muted">A Meta Ad Library ad, an Instagram, TikTok or YouTube video, or a link to a video file.</span>
          </div>
        )}

        {value.source === "library" &&
          (value.picked ? (
            <PickedAd ad={value.picked} onChange={() => setBrowsing(true)} />
          ) : (
            <button
              type="button"
              onClick={() => setBrowsing(true)}
              className={cn(
                "flex items-center gap-3 rounded-ob-lg border border-dashed border-ob-line-strong bg-ob-surface px-4 py-4 text-left transition-colors hover:border-ob-primary",
                focusRing
              )}
            >
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-ob-primary-soft text-ob-primary">
                <Library size={18} />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-bold text-ob-ink">Browse the ad library</span>
                <span className="text-[13px] text-ob-muted">Video ads running now on Facebook and Instagram, by brand or topic</span>
              </span>
            </button>
          ))}
      </div>

      <AdLibraryPicker
        open={browsing}
        onOpenChange={setBrowsing}
        onPick={(picked) => {
          set({ picked });
          setBrowsing(false);
        }}
      />
    </Field>
  );
}

/** The ad picked from the library, with a way to pick another. */
function PickedAd({ ad, onChange }: { ad: LibraryAd; onChange: () => void }) {
  const running = runningFor(ad.startedAt);
  return (
    <div className="flex items-center gap-3 rounded-ob-lg border border-ob-line bg-ob-surface p-3 shadow-ob-xs">
      <div className="h-20 w-14 shrink-0 overflow-hidden rounded-ob bg-ob-dark">
        {ad.previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ad.previewUrl} alt="" className="size-full object-cover" />
        ) : (
          <video src={ad.videoUrl} preload="metadata" muted playsInline className="size-full object-cover" />
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-bold text-ob-ink">{ad.brand || "Unknown brand"}</span>
          {running && <Badge tone="primary" size="sm">{running}</Badge>}
        </div>
        {ad.text && <p className="m-0 line-clamp-2 text-[13px] leading-snug text-ob-ink-soft">{ad.text}</p>}
      </div>
      <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={onChange}>
        Change
      </button>
    </div>
  );
}
