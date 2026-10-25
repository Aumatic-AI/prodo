"use client";

import { useState } from "react";
import { ExternalLink } from "lucide-react";
import { platformMeta } from "@/config/platforms";
import { publicUrl } from "@/components/kit/MediaUploader";
import type { PlanItemView } from "@/core/plans/types";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/SessionStoreProvider";
import { usePostMedia, type PostMedia } from "@/modules/posts/hooks/usePosts";
import { PlatformPreview } from "@/modules/posts/components/previews";
import { mediaUrls } from "@/modules/posts/lib/media-urls";
import { SlotThumb } from "../SlotThumb";

type View = "design" | "post";

/** The box the design is fitted into: 60% of the screen on phones, all the space left on larger screens. */
const stage = "flex h-[60vh] min-h-0 w-full items-center justify-center md:h-auto md:flex-1";
const fitted = "block h-auto max-h-full w-auto max-w-full rounded-ob-md object-contain shadow-ob-sm";

const pill = (on: boolean) =>
  cn(
    "flex items-center gap-1.5 rounded-full border px-3 py-1 text-[12.5px] font-semibold transition-colors",
    on ? "border-ob-primary bg-ob-primary-soft text-ob-primary" : "border-ob-line bg-ob-surface text-ob-muted hover:border-ob-line-strong"
  );

/** Every size of a static ad: the main file and the renditions made for other platforms. */
function sizesOf(media: PostMedia | undefined): { label: string; url: string }[] {
  if (!media?.storage_key) return [];
  const files = (media.files ?? []) as { role: string; storage_key: string; aspect_ratio?: string | null }[];
  return [
    { label: media.aspect_ratio ?? "Main", url: publicUrl(media.storage_key) },
    ...files.filter((f) => f.role === "rendition").map((f) => ({ label: f.aspect_ratio ?? "Other size", url: publicUrl(f.storage_key) })),
  ];
}

/** The whole design, fitted to the space: one image, every slide side by side, or the video. */
function Design({ item, media }: { item: PlanItemView; media: PostMedia | undefined }) {
  const [size, setSize] = useState(0);
  if (item.format === "video" && media?.storage_key) {
    return (
      <div className={stage}>
        <video src={publicUrl(media.storage_key)} controls playsInline preload="metadata" className={cn(fitted, "bg-ob-dark")} />
      </div>
    );
  }

  if (item.format === "carousel") {
    const slides = mediaUrls(media);
    return (
      <div className="flex min-h-0 w-full flex-1 flex-col gap-2">
        <div className={cn(stage, "snap-x snap-mandatory justify-start gap-3 overflow-x-auto pb-2")}>
          {slides.map((url, i) => (
            <a key={url} href={url} target="_blank" rel="noreferrer" className="relative h-full shrink-0 snap-center" title={`Slide ${i + 1}: open full size`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt={`Slide ${i + 1}`} className="h-full w-auto rounded-ob-md object-contain shadow-ob-sm" />
              <span className="absolute left-2 top-2 rounded-full bg-ob-dark/70 px-2 py-0.5 text-[11px] font-bold text-ob-on-dark">
                {i + 1}/{slides.length}
              </span>
            </a>
          ))}
        </div>
        <span className="shrink-0 text-center text-xs text-ob-muted">Swipe or scroll to see every slide · click one for full size</span>
      </div>
    );
  }

  const sizes = sizesOf(media);
  const current = sizes[Math.min(size, sizes.length - 1)];
  if (!current) return null;
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-3">
      {sizes.length > 1 && (
        <div className="flex shrink-0 flex-wrap justify-center gap-1.5" role="tablist" aria-label="Size">
          {sizes.map((s, i) => (
            <button key={s.url} type="button" role="tab" aria-selected={i === size} onClick={() => setSize(i)} className={pill(i === size)}>
              {s.label}
            </button>
          ))}
        </div>
      )}
      <div className={stage}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={current.url} alt="The finished ad" className={fitted} />
      </div>
      <a href={current.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-ob-primary hover:underline">
        <ExternalLink size={13} /> Open full size
      </a>
    </div>
  );
}

/** The finished design (whole, fitted) or how it looks as a post on each platform. */
export function SlotPreview({ item, captions }: { item: PlanItemView; captions: Record<string, string> }) {
  const [view, setView] = useState<View>("design");
  const [platform, setPlatform] = useState(item.platforms[0]);
  const business = useSession((s) => s.business);
  const { data: media } = usePostMedia(item.selected_media_id);
  const ready = item.media?.status === "ready" || item.format === "text";
  // A text post is only ever a post
  const showing: View = item.format === "text" ? "post" : view;

  if (!ready) return <SlotThumb item={item} className="mx-auto aspect-[4/5] w-full max-w-[340px] rounded-ob-lg" />;

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-4">
      {item.format !== "text" && (
        <div className="flex shrink-0 rounded-ob-md border border-ob-line bg-ob-surface p-1" role="tablist" aria-label="Preview">
          {(
            [
              ["design", "Design"],
              ["post", "As post"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={showing === value}
              onClick={() => setView(value)}
              className={cn("rounded-[7px] px-3.5 py-1 text-[13px] font-semibold transition-colors", showing === value ? "bg-ob-primary-soft text-ob-primary" : "text-ob-muted hover:text-ob-ink")}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {showing === "design" ? (
        <Design item={item} media={media} />
      ) : (
        // The post mock-up can be taller than the space: it scrolls on its own
        <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-4 overflow-y-auto">
          {item.platforms.length > 1 && (
            <div className="flex flex-wrap justify-center gap-1.5" role="tablist" aria-label="Preview on">
              {item.platforms.map((p) => {
                const meta = platformMeta(p);
                const Icon = meta.icon;
                return (
                  <button key={p} type="button" role="tab" aria-selected={platform === p} onClick={() => setPlatform(p)} className={pill(platform === p)}>
                    <Icon size={13} /> {meta.label}
                  </button>
                );
              })}
            </div>
          )}
          <div className="w-full max-w-[360px]">
            <PlatformPreview
              platform={platform}
              account={{ displayName: business.name || "Your business" }}
              caption={captions[platform] ?? ""}
              mediaUrls={mediaUrls(media)}
              mediaType={item.format === "static" ? "image" : item.format}
            />
          </div>
        </div>
      )}
    </div>
  );
}
