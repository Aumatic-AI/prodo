"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Upload, X } from "lucide-react";

interface ReferenceImagePickerProps {
  preview: string | null;
  onSelect: (file: File | null) => void;
  label?: string;
  hint?: string;
}

export function ReferenceImagePicker({
  preview,
  onSelect,
  label = "Reference image (optional)",
  hint = "Upload a product or scene photo to guide what the AI generates.",
}: ReferenceImagePickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  function handleFiles(files: FileList | null) {
    const file = files?.[0];
    if (file && file.type.startsWith("image/")) onSelect(file);
  }

  return (
    <div>
      <label className="text-sm font-medium text-text">{label}</label>
      {hint && <p className="text-xs text-muted mt-0.5 mb-2">{hint}</p>}

      {preview ? (
        <div className="relative w-28 h-28 rounded-xl border border-default overflow-hidden">
          <img src={preview} alt="Reference" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            title="Remove"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "w-full py-6 px-4 border-2 border-dashed rounded-xl cursor-pointer transition-colors",
            "flex flex-col items-center gap-2 text-center",
            isDragging
              ? "border-primary bg-primary-subtle"
              : "border-default hover:border-strong hover:bg-surface-hover"
          )}
        >
          <Upload className="w-5 h-5 text-secondary" />
          <div>
            <p className="text-xs font-medium text-text">Click to upload or drag and drop</p>
            <p className="text-[11px] text-muted mt-0.5">PNG, JPG or WebP</p>
          </div>
        </div>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </div>
  );
}
