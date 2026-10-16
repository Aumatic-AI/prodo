"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { MediaGrid } from "../components/MediaGrid";
import { MediaDetailModal } from "../components/MediaDetailModal";
import { CreateContentModal } from "../components/create-content/CreateContentModal";
import { ConfirmModal } from "@/components/ui/ConfirmModal";
import { useMedia, useDeleteMedia, useRetryMedia } from "../hooks/useMedia";
import { Plus } from "lucide-react";
import type { Media, MediaType } from "@/core/media";
import { urlFor } from "@/providers/storage/supabase-storage";

const TABS = [
  { value: "all", label: "All" },
  { value: "image", label: "Images" },
  { value: "video", label: "Videos" },
  { value: "text", label: "Text" },
];

export function MediaPage() {
  const router = useRouter();
  const [tab, setTab] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const [openMedia, setOpenMedia] = useState<Media | null>(null);

  const filterType = tab === "all" ? undefined : (tab as MediaType);
  const { data: media, isLoading, error, refetch } = useMedia(filterType);
  const deleteMutation = useDeleteMedia();
  const retryMutation = useRetryMedia();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const openMediaUrl = openMedia?.storage_key ? urlFor(supabaseUrl, openMedia.storage_key) : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Media</h1>
          <p className="mt-1 text-sm text-muted">Create images, videos, and text posts with AI, or upload your own.</p>
        </div>
        <Button size="sm" onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Create
        </Button>
      </div>

      {/* Content card */}
      <div className="bg-surface rounded-xl border border-default shadow-xs p-6">
        <div className="mb-6">
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
        </div>

        <MediaGrid
          media={media}
          isLoading={isLoading}
          error={error}
          onRefetch={refetch}
          onOpen={(item) => setOpenMedia(item)}
          onRetry={(id) => retryMutation.mutate(id)}
          retryingId={retryMutation.isPending ? (retryMutation.variables ?? null) : null}
          onDelete={(id) => setDeleteTarget(id)}
        />
      </div>

      {/* Create modal */}
      <CreateContentModal open={showCreate} onOpenChange={setShowCreate} />

      {/* Detail modal */}
      <MediaDetailModal
        media={openMedia}
        mediaUrl={openMediaUrl}
        onClose={() => setOpenMedia(null)}
        onCreatePost={() => {
          if (openMedia) router.push(`/posts/new?media=${openMedia.id}`);
          setOpenMedia(null);
        }}
        onDelete={() => {
          if (openMedia) setDeleteTarget(openMedia.id);
          setOpenMedia(null);
        }}
      />

      <ConfirmModal
        open={!!deleteTarget}
        onOpenChange={() => setDeleteTarget(null)}
        title="Delete media"
        description="This will permanently delete this media item. Posts using it won't be affected."
        confirmLabel="Delete"
        variant="danger"
        loading={deleteMutation.isPending}
        error={deleteMutation.error?.message || null}
        onConfirm={async () => {
          if (deleteTarget) {
            await deleteMutation.mutateAsync(deleteTarget);
            setDeleteTarget(null);
          }
        }}
      />
    </div>
  );
}
