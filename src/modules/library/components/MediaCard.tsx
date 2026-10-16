"use client";

import { cn } from "@/lib/utils";
import { StatusChip } from "@/components/ui/StatusChip";
import { Loader } from "@/components/ui/Loader";
import { Image as ImageIcon, Video, FileText, AlertCircle, RotateCcw, Trash2 } from "lucide-react";
import type { Media } from "@/core/media";

interface MediaCardProps {
  media: Media;
  mediaUrl: string | null;
  onOpen: () => void;
  onRetry: () => void;
  retrying?: boolean;
  onDelete: () => void;
}

export function MediaCard({ media, mediaUrl, onOpen, onRetry, retrying, onDelete }: MediaCardProps) {
  const isGenerating = media.status === "generating";
  const isFailed = media.status === "failed";
  const isReady = media.status === "ready";

  return (
    <div className="group relative bg-surface rounded-xl border border-default shadow-xs overflow-hidden transition-shadow hover:shadow-sm">
      {/* Thumbnail */}
      <div
        className="relative aspect-square bg-surface-sunken flex items-center justify-center"
        onClick={isReady ? onOpen : undefined}
        style={isReady ? { cursor: "pointer" } : undefined}
      >
        {isGenerating && (
          <div className="flex flex-col items-center gap-3">
            <Loader size="lg" />
            <span className="text-xs text-muted">Generating...</span>
          </div>
        )}
        {isFailed && (
          <div className="flex flex-col items-center gap-2 px-4 text-center">
            <AlertCircle className="w-8 h-8 text-danger" />
            <span className="text-xs text-danger line-clamp-2">{media.error || "Failed"}</span>
          </div>
        )}
        {isReady && media.type === "text" && (
          <div className="p-4 text-xs text-text leading-relaxed line-clamp-6 self-start w-full">
            {media.content || media.idea || "Text post"}
          </div>
        )}
        {isReady && media.type !== "text" && mediaUrl && (
          media.type === "video" ? (
            <video src={mediaUrl} className="w-full h-full object-cover" />
          ) : (
            <img src={mediaUrl} alt={media.idea || "Media"} className="w-full h-full object-cover" />
          )
        )}
      </div>

      {/* Footer */}
      {isReady ? (
        <div className="flex items-center px-3 py-2.5">
          {media.type === "video" ? (
            <Video className="w-3.5 h-3.5 text-secondary shrink-0" />
          ) : media.type === "text" ? (
            <FileText className="w-3.5 h-3.5 text-secondary shrink-0" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-secondary shrink-0" />
          )}
        </div>
      ) : (
        <div className="flex items-center justify-between px-3 py-2.5">
          {media.type === "video" ? (
            <Video className="w-3.5 h-3.5 text-secondary shrink-0" />
          ) : media.type === "text" ? (
            <FileText className="w-3.5 h-3.5 text-secondary shrink-0" />
          ) : (
            <ImageIcon className="w-3.5 h-3.5 text-secondary shrink-0" />
          )}
          <div className="flex items-center gap-1 shrink-0">
            {!isGenerating && <StatusChip status={media.status} />}
            {isFailed && (
              <button
                onClick={onRetry}
                disabled={retrying}
                className="p-1 text-muted hover:text-primary transition-colors disabled:opacity-50"
                title="Retry"
              >
                <RotateCcw className={cn("w-3.5 h-3.5", retrying && "animate-spin")} />
              </button>
            )}
            {!isGenerating && (
              <button onClick={onDelete} className="p-1 text-muted hover:text-danger transition-colors" title="Delete">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
