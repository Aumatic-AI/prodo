"use client";

import { Button } from "@/components/ui/Button";
import { Send, Trash2, X } from "lucide-react";
import type { Media } from "@/core/media";

interface MediaDetailModalProps {
  media: Media | null;
  mediaUrl: string | null;
  onClose: () => void;
  onCreatePost: () => void;
  onDelete: () => void;
}

export function MediaDetailModal({ media, mediaUrl, onClose, onCreatePost, onDelete }: MediaDetailModalProps) {
  if (!media) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div className="relative w-full max-w-3xl max-h-[90vh] bg-surface rounded-xl shadow-xl overflow-hidden flex flex-col">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-default shrink-0">
          <Button size="sm" onClick={onCreatePost}>
            <Send className="w-3.5 h-3.5" />
            Create post
          </Button>
          <div className="flex items-center gap-1">
            <button
              onClick={onDelete}
              className="p-2 text-muted hover:text-danger transition-colors"
              title="Delete"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-muted hover:text-text transition-colors"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media */}
        <div className="flex-1 overflow-y-auto">
          <div className="bg-surface-sunken flex items-center justify-center min-h-[300px]">
            {media.type === "text" ? (
              <div className="p-6 text-sm text-text leading-relaxed whitespace-pre-wrap w-full max-w-xl mx-auto">
                {media.content || media.idea}
              </div>
            ) : media.type === "video" ? (
              mediaUrl && (
                <video src={mediaUrl} controls className="max-w-full max-h-[60vh] mx-auto" />
              )
            ) : (
              mediaUrl && (
                <img
                  src={mediaUrl}
                  alt={media.idea || "Media"}
                  className="max-w-full max-h-[60vh] mx-auto object-contain"
                />
              )
            )}
          </div>

          {media.idea && media.type !== "text" && (
            <div className="px-6 py-4 border-t border-default">
              <p className="text-xs font-medium text-muted mb-1">Prompt</p>
              <p className="text-sm text-text">{media.idea}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
