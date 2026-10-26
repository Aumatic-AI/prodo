"use client";

import { useRef, useState, type DragEvent } from "react";
import { ImageIcon, Loader2, Upload } from "lucide-react";
import { UPLOAD_RULES } from "@/config/uploads";
import { useUpload } from "@/components/kit/useUpload";
import { button, focusRing, hint } from "@/components/kit/styles";
import { cn } from "@/lib/utils";
import { FieldError } from "./Field";
import { publicUrl } from "@/components/kit/MediaUploader";

interface LogoUploaderProps {
  value: string | null;
  onChange: (key: string | null) => void;
}

/** Logo picker: click the box or the button, or drop an image anywhere on it. */
export function LogoUploader({ value, onChange }: LogoUploaderProps) {
  const upload = useUpload("logo");
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(file: File | undefined) {
    if (!file || busy) return;
    setError(null);
    setBusy(true);
    try {
      onChange((await upload(file)).key);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
    }
  }

  function onDragOver(e: DragEvent) {
    if (!e.dataTransfer.types.includes("Files")) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
    setDragging(true);
  }

  function onDragLeave(e: DragEvent) {
    // Moving onto a child element isn't leaving
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false);
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    pick(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="flex flex-col gap-3" onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          aria-label={value ? "Replace logo" : "Upload logo"}
          className={cn(
            "grid size-[88px] shrink-0 cursor-pointer place-items-center overflow-hidden rounded-ob-md border bg-ob-sunken transition-colors disabled:cursor-default",
            dragging ? "border-2 border-dashed border-ob-primary bg-ob-primary-soft" : "border-ob-line hover:border-ob-line-strong",
            focusRing
          )}
        >
          {busy ? (
            <Loader2 size={22} className="animate-spin" aria-label="Uploading" />
          ) : dragging ? (
            <span className="flex flex-col items-center gap-1 text-[11px] font-semibold text-ob-primary">
              <Upload size={20} aria-hidden="true" />
              Drop here
            </span>
          ) : value ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicUrl(value)} alt="Your logo" className="max-h-[80%] max-w-[80%] object-contain" />
          ) : (
            <ImageIcon size={26} className="text-ob-faint" aria-hidden="true" />
          )}
        </button>
        <div className="flex flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-2.5">
            <button type="button" className={button({ variant: "secondary", size: "sm" })} disabled={busy} onClick={() => inputRef.current?.click()}>
              {value ? "Replace logo" : "Upload logo"}
            </button>
            {value && !busy && (
              <button type="button" className={button({ variant: "danger", size: "sm" })} onClick={() => onChange(null)}>
                Remove
              </button>
            )}
          </div>
          <span className={hint}>{UPLOAD_RULES.logo.hint}. Transparent background works best. Or drag it onto the box.</span>
        </div>
      </div>
      <input
        ref={inputRef}
        type="file"
        hidden
        accept={UPLOAD_RULES.logo.types.join(",")}
        onChange={(e) => {
          pick(e.target.files?.[0]);
          // The same file can be picked again after a failed upload
          e.target.value = "";
        }}
      />
      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
