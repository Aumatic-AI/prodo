"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, SearchX } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { EmptyState } from "@/components/kit/EmptyState";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { useDeleteMedia, useMedia, useRetryMedia } from "../hooks/useMedia";
import { MediaGrid, gridClass } from "../components/MediaGrid";
import { MediaToolbar, type MediaFilters, type TypeFilter } from "../components/MediaToolbar";
import { MediaDetailModal } from "../components/detail/MediaDetailModal";
import { CreateContentModal, type CreateTab } from "../components/create-content/CreateContentModal";
import { QuickStart } from "../components/QuickStart";
import type { MediaListItem } from "../types";

const NO_FILTERS: MediaFilters = { type: "all", status: "all", search: "" };

/** Media library: everything made or uploaded, ready to post. */
export function MediaPage() {
  const router = useRouter();
  const { data: media, isLoading, error } = useMedia();
  const retry = useRetryMedia();
  const remove = useDeleteMedia();

  const [filters, setFilters] = useState<MediaFilters>(NO_FILTERS);
  const [createTab, setCreateTab] = useState<CreateTab | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<MediaListItem | null>(null);

  const all = useMemo(() => media ?? [], [media]);
  // Read the open item from the list, so its status stays live
  const open = all.find((m) => m.id === openId) ?? null;

  const counts = useMemo(() => {
    const c: Record<TypeFilter, number> = { all: all.length, image: 0, video: 0, carousel: 0, text: 0 };
    for (const m of all) c[m.type] += 1;
    return c;
  }, [all]);

  const shown = useMemo(() => {
    const q = filters.search.trim().toLowerCase();
    return all
      .filter((m) => filters.type === "all" || m.type === filters.type)
      .filter((m) => filters.status === "all" || m.status === filters.status)
      .filter((m) => !q || [m.idea, m.content, m.product_name].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
  }, [all, filters]);

  const createPost = (m: MediaListItem) => router.push(`/posts/new?media=${m.id}`);
  const generating = counts.all ? all.filter((m) => m.status === "generating").length : 0;

  return (
    <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
      <PageHeader
        eyebrow="Content"
        title="Media"
        description={generating ? `${generating} being made right now. They appear here when ready.` : "Images, videos, carousels and text, made by you or by Prodo, ready to post."}
        actions={
          <button type="button" className={button()} onClick={() => setCreateTab("image")}>
            <Plus size={17} /> Create
          </button>
        }
      />

      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : isLoading ? (
        <div className={gridClass}>
          {Array.from({ length: 10 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] rounded-ob-lg" />
          ))}
        </div>
      ) : !all.length ? (
        <QuickStart onStart={setCreateTab} />
      ) : (
        <>
          <MediaToolbar value={filters} onChange={setFilters} counts={counts} />
          {shown.length ? (
            <MediaGrid
              media={shown}
              onOpen={(m) => setOpenId(m.id)}
              onCreatePost={createPost}
              onRetry={(id) => retry.mutate(id)}
              retryingId={retry.isPending ? (retry.variables ?? null) : null}
              onDelete={setDeleting}
            />
          ) : (
            <EmptyState
              icon={SearchX}
              title="Nothing matches"
              description="Try another type or status, or clear the search."
              action={
                <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setFilters(NO_FILTERS)}>
                  Clear filters
                </button>
              }
            />
          )}
        </>
      )}

      {createTab && <CreateContentModal initialTab={createTab} onClose={() => setCreateTab(null)} />}

      <MediaDetailModal
        media={open}
        onClose={() => setOpenId(null)}
        onCreatePost={createPost}
        onRetry={(m) => {
          retry.mutate(m.id);
          setOpenId(null);
        }}
        onDelete={(m) => {
          setOpenId(null);
          setDeleting(m);
        }}
      />

      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Delete this media?"
        description={<p className="m-0">The file is removed for good. Media used by a post can&apos;t be deleted; delete the post first.</p>}
        confirmLabel="Delete"
        danger
        busy={remove.isPending}
        error={remove.error?.message}
        onConfirm={async () => {
          if (!deleting) return;
          // A failure stays in the dialog (remove.error)
          await remove.mutateAsync(deleting.id).then(() => setDeleting(null), () => undefined);
        }}
      />
    </div>
  );
}
