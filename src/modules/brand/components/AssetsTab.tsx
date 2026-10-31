"use client";

import { useRef, useState } from "react";
import { ImagePlus, Images, Loader2, Pencil, Play, Trash2, Video } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { Badge } from "@/components/kit/Badge";
import { EmptyState } from "@/components/kit/EmptyState";
import { Skeleton } from "@/components/kit/Skeleton";
import { isVideoKey, publicUrl } from "@/components/kit/MediaUploader";
import { useUpload } from "@/components/kit/useUpload";
import { button } from "@/components/kit/styles";
import { UPLOAD_RULES } from "@/config/uploads";
import { RESOURCES, type ResourceRow } from "@/core/brand/resources";
import { cn } from "@/lib/utils";
import { useResource, useResourceMutations } from "../hooks/useResource";
import { ResourceForm } from "./resources/ResourceForm";

const KIND_LABEL = Object.fromEntries((RESOURCES.assets.fields[0].options ?? []).map((o) => [o.value, o.label]));
const FILTERS = [{ value: "all", label: "All" }, ...(RESOURCES.assets.fields[0].options ?? [])];

/** The client's own photos and videos (agents use them in ads), plus posts from other brands they like (studied, never used as theirs). */
export function AssetsTab() {
  const { data: assets, isLoading, error } = useResource("assets");
  const { create, update, remove } = useResourceMutations("assets");
  const uploadPhoto = useUpload("photo");
  const uploadVideo = useUpload("video");
  const photoInput = useRef<HTMLInputElement>(null);
  const videoInput = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<number>(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editing, setEditing] = useState<ResourceRow | null>(null);
  const [filter, setFilter] = useState("all");

  async function onFiles(files: FileList | null, video: boolean) {
    if (!files?.length) return;
    setUploadError(null);
    setUploading(files.length);
    try {
      for (const file of Array.from(files)) {
        const { key } = await (video ? uploadVideo : uploadPhoto)(file);
        // The client's own footage; other brands' videos are marked "Video we like" afterwards
        await create.mutateAsync({ storage_key: key, kind: video ? "general" : "product_photo", tags: [] });
        setUploading((n) => n - 1);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "The upload failed. Try again.");
    } finally {
      setUploading(0);
    }
  }

  const shown = (assets ?? []).filter((a) => filter === "all" || a.kind === filter);
  const uploadButtons = (
    <div className="flex flex-wrap gap-2">
      <button type="button" className={button({ size: "sm" })} disabled={uploading > 0} onClick={() => photoInput.current?.click()}>
        {uploading > 0 ? <Loader2 size={15} className="animate-spin" /> : <ImagePlus size={15} />}
        {uploading > 0 ? `Uploading ${uploading}…` : "Upload photos"}
      </button>
      <button type="button" className={button({ variant: "secondary", size: "sm" })} disabled={uploading > 0} onClick={() => videoInput.current?.click()}>
        <Video size={15} /> Upload videos
      </button>
    </div>
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter by kind">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "rounded-full border px-3 py-1 text-[13px] font-semibold transition-colors",
                filter === f.value ? "border-ob-primary bg-ob-primary-soft text-ob-primary" : "border-ob-line bg-ob-surface text-ob-muted hover:border-ob-line-strong"
              )}
            >
              {f.label}
            </button>
          ))}
        </div>
        {uploadButtons}
        <input ref={photoInput} type="file" hidden multiple accept={UPLOAD_RULES.photo.types.join(",")} onChange={(e) => onFiles(e.target.files, false)} />
        <input ref={videoInput} type="file" hidden multiple accept={UPLOAD_RULES.video.types.join(",")} onChange={(e) => onFiles(e.target.files, true)} />
      </div>
      {uploadError && <Alert tone="error">{uploadError}</Alert>}

      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : isLoading ? (
        <Skeleton className="h-56" />
      ) : !shown.length ? (
        <EmptyState
          icon={Images}
          title={filter === "all" ? "No photos or videos yet" : "Nothing in this group"}
          description={`Real photos of your products, team and work make ads more believable than AI images alone. ${UPLOAD_RULES.photo.hint}.`}
          action={filter === "all" ? uploadButtons : undefined}
        />
      ) : (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-4">
          {shown.map((a) => {
            const key = String(a.storage_key);
            const isVideo = isVideoKey(key);
            // The client's own videos are watched for moments the ads can use
            const analysis = a.analysis as { moments?: unknown[]; error?: string } | null | undefined;
            const footage = isVideo && a.kind !== "reference_video" ? (!analysis ? "Being watched" : analysis.error ? "Couldn't be read" : `${analysis.moments?.length ?? 0} usable moments`) : null;
            return (
              <figure key={a.id} className="group relative m-0 overflow-hidden rounded-ob-md border border-ob-line bg-ob-surface shadow-ob-xs">
                <div className="relative aspect-square bg-ob-sunken">
                  {isVideo ? (
                    <>
                      <video src={publicUrl(key)} muted playsInline preload="metadata" className="size-full object-cover" />
                      <span className="absolute left-2 top-2 grid size-7 place-items-center rounded-full bg-ob-dark/70 text-ob-on-dark">
                        <Play size={13} fill="currentColor" />
                      </span>
                    </>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={publicUrl(key)} alt="" className="size-full object-cover" />
                  )}
                  <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <button type="button" className={cn(button({ variant: "secondary", size: "iconSm" }), "shadow-ob-sm")} aria-label="Edit" onClick={() => setEditing(a)}>
                      <Pencil size={14} />
                    </button>
                    <button type="button" className={cn(button({ variant: "secondary", size: "iconSm" }), "shadow-ob-sm hover:text-ob-danger")} aria-label="Delete" onClick={() => remove.mutate(a.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <figcaption className="flex items-center justify-between gap-2 px-3 py-2.5">
                  <Badge size="sm">{KIND_LABEL[String(a.kind)] ?? String(a.kind)}</Badge>
                  {footage ? (
                    <span className="truncate text-xs text-ob-muted">{footage}</span>
                  ) : (
                    Array.isArray(a.tags) && a.tags.length > 0 && <span className="truncate text-xs text-ob-muted">{(a.tags as string[]).join(", ")}</span>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>
      )}

      {editing && (
        <ResourceForm
          key={editing.id}
          resource="assets"
          row={editing}
          saving={update.isPending}
          error={update.error?.message}
          onClose={() => setEditing(null)}
          onSave={async (values) => {
            await update.mutateAsync({ id: editing.id, values });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
