"use client";

import { MediaCard } from "./MediaCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Images } from "lucide-react";
import type { Media } from "@/core/media";
import { urlFor } from "@/providers/storage/supabase-storage";

interface MediaGridProps {
  media: Media[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  onOpen: (media: Media) => void;
  onRetry: (id: string) => void;
  retryingId?: string | null;
  onDelete: (id: string) => void;
}

export function MediaGrid({
  media,
  isLoading,
  error,
  onRefetch,
  onOpen,
  onRetry,
  retryingId,
  onDelete,
}: MediaGridProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-default overflow-hidden">
            <Skeleton className="aspect-square" />
            <div className="p-3">
              <Skeleton className="h-4 w-2/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) return <ErrorState message="Failed to load media" onRetry={onRefetch} />;

  if (!media?.length) {
    return (
      <EmptyState
        icon={Images}
        title="No media yet"
        description="Create an image or video with AI, or upload your own."
      />
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {media.map((item) => (
        <MediaCard
          key={item.id}
          media={item}
          mediaUrl={item.storage_key ? urlFor(supabaseUrl, item.storage_key) : null}
          onOpen={() => onOpen(item)}
          onRetry={() => onRetry(item.id)}
          retrying={item.id === retryingId}
          onDelete={() => onDelete(item.id)}
        />
      ))}
    </div>
  );
}
