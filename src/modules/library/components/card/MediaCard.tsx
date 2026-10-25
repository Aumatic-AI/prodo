"use client";

import { Bot, Expand, Layers, Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/kit/Badge";
import { button, focusRing } from "@/components/kit/styles";
import { STATUS_META, TYPE_META, relativeDate } from "../../lib/display";
import type { MediaListItem } from "../../types";
import { MediaCover } from "./MediaCover";
import { FailedCover, GeneratingCover } from "./CardStates";

interface MediaCardProps {
  media: MediaListItem;
  onOpen: () => void;
  onCreatePost: () => void;
  onRetry: () => void;
  retrying: boolean;
  onDelete: () => void;
}

const actionButton = cn(button({ variant: "secondary", size: "iconSm" }), "border-transparent bg-ob-surface/95 shadow-ob-sm backdrop-blur-sm");

/** One item in the Media grid: cover, type and status, product and date, actions on hover. */
export function MediaCard({ media, onOpen, onCreatePost, onRetry, retrying, onDelete }: MediaCardProps) {
  const type = TYPE_META[media.type];
  const TypeIcon = type.icon;
  const ready = media.status === "ready";
  const isCarousel = media.type === "carousel";

  return (
    <article className="group relative flex flex-col pt-2">
      {/* Stacked sheets behind a carousel */}
      {isCarousel && ready && (
        <>
          <span className="absolute inset-x-4 top-0 h-6 rounded-t-ob-lg border border-ob-line bg-ob-surface/70" aria-hidden="true" />
          <span className="absolute inset-x-2 top-1 h-6 rounded-t-ob-lg border border-ob-line bg-ob-surface" aria-hidden="true" />
        </>
      )}

      <div
        className={cn(
          "relative flex flex-col overflow-hidden rounded-ob-lg border border-ob-line bg-ob-surface shadow-ob-xs transition-[transform,box-shadow,border-color] duration-200",
          ready && "hover:-translate-y-0.5 hover:border-ob-line-strong hover:shadow-ob-md"
        )}
      >
        <div
          role={ready ? "button" : undefined}
          tabIndex={ready ? 0 : undefined}
          aria-label={ready ? `Open ${type.label.toLowerCase()}` : undefined}
          onClick={ready ? onOpen : undefined}
          onKeyDown={(e) => ready && (e.key === "Enter" || e.key === " ") && (e.preventDefault(), onOpen())}
          className={cn("relative aspect-[4/5] overflow-hidden bg-ob-sunken", ready && "cursor-pointer", focusRing)}
        >
          {media.status === "generating" ? (
            <GeneratingCover media={media} />
          ) : media.status === "failed" ? (
            <FailedCover media={media} onRetry={onRetry} retrying={retrying} />
          ) : (
            <MediaCover media={media} />
          )}

          <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between gap-2 p-3">
            <span className="flex flex-wrap gap-1.5">
              <Badge tone="dark" size="sm" className="bg-ob-dark/75 backdrop-blur-sm">
                <TypeIcon size={12} />
                {type.label}
                {isCarousel && media.slide_count ? ` · ${media.slide_count}` : ""}
              </Badge>
              {media.plan_item_id && (
                <Badge tone="primary" size="sm" className="shadow-ob-xs">
                  <Bot size={12} />
                  Made by Prodo
                </Badge>
              )}
              {media.variant_of && (
                <Badge tone="neutral" size="sm" className="bg-ob-surface/90 shadow-ob-xs">
                  <Layers size={12} />
                  New version
                </Badge>
              )}
            </span>
          </div>

          {media.status !== "generating" && (
            <div className="absolute right-3 top-3 flex gap-1.5 opacity-0 transition-opacity duration-150 focus-within:opacity-100 group-hover:opacity-100">
              {ready && (
                <button type="button" className={actionButton} aria-label="Open" title="Open" onClick={onOpen}>
                  <Expand size={14} />
                </button>
              )}
              {ready && (
                <button type="button" className={actionButton} aria-label="Create post" title="Create post" onClick={onCreatePost}>
                  <Send size={14} />
                </button>
              )}
              <button type="button" className={cn(actionButton, "hover:text-ob-danger")} aria-label="Delete" title="Delete" onClick={onDelete}>
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-1.5 px-4 py-3">
          <p className="m-0 line-clamp-1 text-sm font-semibold text-ob-ink" title={media.idea || undefined}>
            {media.idea || media.content || (media.source === "uploaded" ? "Uploaded file" : "Untitled")}
          </p>
          <div className="flex items-center justify-between gap-2 text-xs text-ob-muted">
            <span className="min-w-0 truncate">{media.product_name ?? (media.source === "uploaded" ? "Uploaded" : "No product")}</span>
            <span className="flex shrink-0 items-center gap-2">
              {!ready && (
                <Badge tone={STATUS_META[media.status].tone} size="sm">
                  {STATUS_META[media.status].label}
                </Badge>
              )}
              <time dateTime={media.created_at}>{relativeDate(media.created_at)}</time>
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
