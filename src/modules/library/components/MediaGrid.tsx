"use client";

import type { MediaListItem } from "../types";
import { MediaCard } from "./card/MediaCard";

interface MediaGridProps {
  media: MediaListItem[];
  onOpen: (media: MediaListItem) => void;
  onCreatePost: (media: MediaListItem) => void;
  onRetry: (id: string) => void;
  retryingId: string | null;
  onDelete: (media: MediaListItem) => void;
}

export const gridClass = "grid grid-cols-2 gap-x-4 gap-y-5 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5";

export function MediaGrid({ media, onOpen, onCreatePost, onRetry, retryingId, onDelete }: MediaGridProps) {
  return (
    <div className={gridClass}>
      {media.map((item) => (
        <MediaCard
          key={item.id}
          media={item}
          onOpen={() => onOpen(item)}
          onCreatePost={() => onCreatePost(item)}
          onRetry={() => onRetry(item.id)}
          retrying={retryingId === item.id}
          onDelete={() => onDelete(item)}
        />
      ))}
    </div>
  );
}
