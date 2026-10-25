"use client";

import { useRef, useState, type DragEvent } from "react";
import { Loader2, Upload as UploadIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { UPLOAD_RULES, type UploadPurpose } from "@/config/uploads";
import { urlFor } from "@/providers/storage/supabase-storage";
import type { Upload } from "@/core/onboarding/schemas";
import { useUpload } from "@/components/kit/useUpload";
import { focusRing } from "@/components/kit/styles";
import { FieldError } from "./Field";

interface Pending {
  tempId: string;
  previewUrl: string;
}

interface MediaUploaderProps<T extends Upload> {
  purpose: Extract<UploadPurpose, "photo" | "video">;
  value: T[];
  onChange: (value: T[]) => void;
  max: number;
  /** Adds fields to each new upload, e.g. a photo kind */
  extend?: (upload: Upload) => T;
  /** Small label shown on each thumbnail */
  tagOf?: (item: T) => string | undefined;
}

export function publicUrl(key: string): string {
  return urlFor(process.env.NEXT_PUBLIC_SUPABASE_URL!, key);
}

/** Drag-and-drop gallery. Files upload at once; the list holds storage keys. */
export function MediaUploader<T extends Upload>({ purpose, value, onChange, max, extend, tagOf }: MediaUploaderProps<T>) {
  const upload = useUpload(purpose);
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<Pending[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const rule = UPLOAD_RULES[purpose];
  const isVideo = purpose === "video";
  const room = max - value.length - pending.length;

  // Latest list for uploads that finish after other changes
  const valueRef = useRef(value);
  valueRef.current = value;

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const picked = Array.from(files).slice(0, Math.max(room, 0));
    if (files.length > picked.length) setError(`You can add up to ${max}.`);

    await Promise.all(
      picked.map(async (file) => {
        const item: Pending = { tempId: crypto.randomUUID(), previewUrl: URL.createObjectURL(file) };
        setPending((p) => [...p, item]);
        try {
          const uploaded = await upload(file);
          const next = [...valueRef.current, (extend ? extend(uploaded) : uploaded) as T];
          valueRef.current = next;
          onChange(next);
        } catch (err) {
          setError(err instanceof Error ? err.message : "Upload failed");
        } finally {
          URL.revokeObjectURL(item.previewUrl);
          setPending((p) => p.filter((x) => x.tempId !== item.tempId));
        }
      })
    );
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    addFiles(e.dataTransfer.files);
  }

  // Plain <img>: previews include local blob URLs, which next/image can't load
  const preview = (src: string) =>
    isVideo ? (
      <video src={src} muted playsInline preload="metadata" className="size-full object-cover" />
    ) : (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="size-full object-cover" />
    );

  const thumb = "group/thumb relative aspect-square overflow-hidden rounded-ob border border-ob-line bg-ob-sunken";

  return (
    <div className="flex flex-col gap-3">
      {(value.length > 0 || pending.length > 0) && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-2.5">
          {value.map((item) => (
            <div key={item.id} className={thumb}>
              {preview(publicUrl(item.key))}
              {tagOf?.(item) && (
                <span className="absolute bottom-1.5 left-1.5 rounded-full bg-ob-dark/75 px-2 text-[11px] font-semibold text-ob-on-dark">{tagOf(item)}</span>
              )}
              <button
                type="button"
                aria-label="Remove"
                onClick={() => onChange(value.filter((v) => v.id !== item.id))}
                className={cn(
                  "absolute right-1.5 top-1.5 grid size-[26px] place-items-center rounded-full bg-ob-dark/75 text-ob-on-dark opacity-0 transition-opacity group-hover/thumb:opacity-100 focus-visible:opacity-100",
                  focusRing
                )}
              >
                <X size={14} />
              </button>
            </div>
          ))}
          {pending.map((p) => (
            <div key={p.tempId} className={thumb}>
              {preview(p.previewUrl)}
              <span className="absolute inset-0 grid place-items-center bg-ob-surface/70">
                <Loader2 size={20} className="animate-spin" aria-label="Uploading" />
              </span>
            </div>
          ))}
        </div>
      )}

      {room > 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={cn(
            "flex w-full flex-col items-center gap-1.5 rounded-ob-md border-2 border-dashed px-5 py-[22px] text-center transition-colors duration-150",
            "hover:border-ob-primary hover:bg-ob-primary-soft",
            dragging ? "border-ob-primary bg-ob-primary-soft" : "border-ob-line-strong bg-ob-sunken",
            focusRing
          )}
        >
          <span className="grid size-10 place-items-center rounded-full bg-ob-surface text-ob-primary shadow-ob-sm">
            <UploadIcon size={18} />
          </span>
          <span className="text-sm font-semibold text-ob-ink">
            Drag files here or <u className="text-ob-primary underline-offset-[3px]">browse</u>
          </span>
          <span className="text-[13px] text-ob-muted">{rule.hint}</span>
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        hidden
        multiple={max > 1}
        accept={rule.types.join(",")}
        onChange={(e) => {
          addFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
