"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/Button";
import { Upload, X, Image as ImageIcon, Video } from "lucide-react";
import { cn } from "@/lib/utils";

export function UploadTab({ onSuccess }: { onSuccess: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isVideo = file?.type.startsWith("video/");

  function handleFile(f: File | null) {
    if (preview) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    try {
      // TODO: POST to /api/media/upload to register the uploaded file
      onSuccess();
      handleFile(null);
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="space-y-5">
      {!file ? (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "w-full py-12 border-2 border-dashed border-default rounded-xl",
            "flex flex-col items-center gap-3 text-center",
            "hover:border-strong hover:bg-surface-hover transition-colors"
          )}
        >
          <Upload className="w-8 h-8 text-secondary" />
          <div>
            <p className="text-sm font-medium text-text">Click to upload</p>
            <p className="text-xs text-muted mt-1">Images (PNG, JPG, WebP) or videos (MP4, MOV)</p>
          </div>
        </button>
      ) : (
        <div className="relative rounded-xl border border-default overflow-hidden">
          <div className="aspect-video flex items-center justify-center" style={{ backgroundColor: "var(--color-page)" }}>
            {isVideo ? (
              <video src={preview!} className="max-h-full max-w-full" controls />
            ) : (
              <img src={preview!} alt="Preview" className="max-h-full max-w-full object-contain" />
            )}
          </div>
          <div className="flex items-center justify-between px-3 py-2 bg-surface">
            <div className="flex items-center gap-2 text-sm text-muted min-w-0">
              {isVideo ? <Video className="w-4 h-4 shrink-0" /> : <ImageIcon className="w-4 h-4 shrink-0" />}
              <span className="truncate">{file.name}</span>
            </div>
            <button onClick={() => handleFile(null)} className="text-muted hover:text-danger transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,video/mp4,video/quicktime"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />

      <div className="flex justify-end gap-3 pt-2">
        <Button
          onClick={handleUpload}
          loading={uploading}
          disabled={!file}
        >
          Upload
        </Button>
      </div>
    </div>
  );
}
