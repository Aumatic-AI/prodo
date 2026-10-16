"use client";

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { Camera, X } from "lucide-react";

interface LogoPickerProps {
  currentUrl: string | null;
  previewUrl: string | null;
  onSelect: (file: File | null) => void;
}

export function LogoPicker({ currentUrl, previewUrl, onSelect }: LogoPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayUrl = previewUrl || currentUrl;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm font-medium text-text">Logo</label>
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative w-20 h-20 rounded-xl border-2 border-dashed border-default",
            "flex items-center justify-center overflow-hidden",
            "hover:border-strong transition-colors group"
          )}
        >
          {displayUrl ? (
            <>
              <img src={displayUrl} alt="Logo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Camera className="w-5 h-5 text-white" />
              </div>
            </>
          ) : (
            <Camera className="w-6 h-6 text-secondary" />
          )}
        </button>
        {displayUrl && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-xs text-muted hover:text-danger transition-colors flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Remove
          </button>
        )}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
          e.target.value = "";
        }}
      />
      <p className="text-xs text-secondary">JPG, PNG or WebP. Max 2MB.</p>
    </div>
  );
}
