"use client";

import { useState } from "react";
import { ArrowUp, X } from "lucide-react";
import { IMAGE_STYLES, MAX_STYLES, VIDEO_STYLES, type ImageStyle, type VideoStyle } from "@/core/onboarding/options";
import { cn } from "@/lib/utils";
import { focusRing, hint, label } from "@/components/kit/styles";
import { StyleArt } from "./StyleArt";
import { imageStyleWords, soundLabel, videoStyleWords } from "./labels";

type Kind = "image" | "video";

const KEY = { image: "imageStyles", video: "videoStyles" } as const;

export interface StylePicks {
  imageStyles: ImageStyle[];
  videoStyles: VideoStyle[];
}

/**
 * Tiles for the post styles in one tab, picked in order, plus the picked order below. Used by
 * onboarding and Settings → Content.
 */
export function StylePicker({ videos, service, value, onChange }: { videos: boolean; service: boolean; value: StylePicks; onChange: (patch: Partial<StylePicks>) => void }) {
  const [tab, setTab] = useState<Kind>("image");
  const kind: Kind = videos ? tab : "image";

  const picked = (kind === "image" ? value.imageStyles : value.videoStyles) as string[];
  const set = (next: string[]) => onChange({ [KEY[kind]]: next });
  const words = (style: string) =>
    kind === "image" ? imageStyleWords(style as ImageStyle, service) : videoStyleWords(style as VideoStyle, service);
  const full = picked.length >= MAX_STYLES;

  function toggle(style: string) {
    set(picked.includes(style) ? picked.filter((s) => s !== style) : full ? picked : [...picked, style]);
  }

  function moveUp(index: number) {
    const next = [...picked];
    [next[index - 1], next[index]] = [next[index], next[index - 1]];
    set(next);
  }

  const styles: readonly string[] = kind === "image" ? IMAGE_STYLES : VIDEO_STYLES;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {videos ? (
          <div role="tablist" aria-label="Kind of post" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-ob border border-ob-line bg-ob-sunken p-1">
            {(["image", "video"] as const).map((k) => (
              <button
                key={k}
                type="button"
                role="tab"
                aria-selected={kind === k}
                onClick={() => setTab(k)}
                className={cn(
                  "whitespace-nowrap rounded-[7px] px-3.5 py-[7px] text-sm font-bold transition-colors",
                  focusRing,
                  kind === k ? "bg-ob-surface text-ob-ink shadow-ob-xs" : "text-ob-muted hover:text-ob-ink"
                )}
              >
                {k === "image" ? "Images and carousels" : "Videos"}
                {(k === "image" ? value.imageStyles : value.videoStyles).length > 0 && (
                  <span className="ml-1.5 text-ob-primary">{(k === "image" ? value.imageStyles : value.videoStyles).length}</span>
                )}
              </button>
            ))}
          </div>
        ) : (
          <span />
        )}
        <span className={hint}>Pick up to {MAX_STYLES}</span>
      </div>

      <div role="group" aria-label={kind === "image" ? "Image styles" : "Video styles"} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3">
        {styles.map((style) => {
          const place = picked.indexOf(style);
          const on = place >= 0;
          const w = words(style);
          return (
            <button
              key={style}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => toggle(style)}
              className={cn(
                "relative flex flex-col overflow-hidden rounded-ob-md border bg-ob-surface p-0 text-left transition-[border-color,box-shadow,opacity] duration-150 disabled:cursor-not-allowed disabled:opacity-50",
                focusRing,
                on ? "border-ob-primary shadow-[inset_0_0_0_1px_var(--color-ob-primary)]" : "border-ob-line-strong enabled:hover:border-ob-primary enabled:hover:shadow-ob-sm"
              )}
            >
              <span className="relative block aspect-[4/5] overflow-hidden border-b border-ob-line bg-ob-sunken">
                <StyleArt kind={kind} style={style as ImageStyle & VideoStyle} service={service} />
              </span>
              <span
                aria-hidden="true"
                className={cn(
                  "absolute left-2 top-2 grid size-7 place-items-center rounded-full border-2 text-[13px] font-extrabold",
                  on ? "border-ob-primary bg-ob-primary text-ob-on-primary" : "border-ob-line-strong bg-ob-surface/90"
                )}
              >
                {on ? place + 1 : ""}
              </span>
              <span className={cn("flex flex-1 flex-col gap-0.5 px-3 pb-3 pt-2.5", on && "bg-ob-primary-soft")}>
                <span className="text-sm font-bold leading-snug text-ob-ink">
                  {w.title}
                  {on && <span className="sr-only">, picked {place + 1}</span>}
                </span>
                <span className="text-[12.5px] leading-snug text-ob-muted">{w.description}</span>
                {kind === "video" && (
                  <span className="mt-1.5 self-start rounded-full bg-ob-primary-soft px-2 py-0.5 text-[11.5px] font-bold text-ob-primary">
                    {soundLabel(style as VideoStyle)}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-col gap-2">
        <span className={label}>Your order{videos ? `: ${kind === "image" ? "images" : "videos"}` : ""}</span>
        {picked.length ? (
          <ol aria-label="Your order" className="m-0 flex list-none flex-wrap gap-2 p-0">
            {picked.map((style, i) => (
              <li
                key={style}
                className="inline-flex items-center gap-2 rounded-full border border-ob-primary/30 bg-ob-primary-soft py-1 pl-1.5 pr-1.5 text-sm font-semibold text-ob-primary-ink"
              >
                <span className="grid size-6 place-items-center rounded-full bg-ob-primary text-xs font-bold text-ob-on-primary">{i + 1}</span>
                {words(style).title}
                {i > 0 && (
                  <button type="button" aria-label={`Move ${words(style).title} up`} onClick={() => moveUp(i)} className={cn("grid size-[22px] place-items-center rounded-full hover:bg-ob-primary/15", focusRing)}>
                    <ArrowUp size={13} />
                  </button>
                )}
                <button
                  type="button"
                  aria-label={`Remove ${words(style).title}`}
                  onClick={() => set(picked.filter((s) => s !== style))}
                  className={cn("grid size-[22px] place-items-center rounded-full hover:bg-ob-primary/15", focusRing)}
                >
                  <X size={13} />
                </button>
              </li>
            ))}
          </ol>
        ) : (
          <span className={hint}>Nothing picked yet: Prodo will try a wide mix and learn what works.</span>
        )}
        <span className={hint}>Your first pick is used most and the rest are mixed in. Prodo keeps your order, then adjusts it from real results.</span>
      </div>
    </div>
  );
}
