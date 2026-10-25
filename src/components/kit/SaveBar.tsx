"use client";

import { Loader2 } from "lucide-react";
import { button } from "./styles";

interface SaveBarProps {
  show: boolean;
  saving: boolean;
  error?: string | null;
  onSave: () => void;
  onDiscard: () => void;
  saveLabel?: string;
}

/** Floating bar at the bottom of a form while it has unsaved changes. */
export function SaveBar({ show, saving, error, onSave, onDiscard, saveLabel = "Save changes" }: SaveBarProps) {
  if (!show) return null;
  return (
    <div
      role="region"
      aria-label="Unsaved changes"
      className="sticky bottom-5 z-20 mt-2 flex flex-wrap items-center justify-between gap-3 rounded-ob-lg border border-ob-line bg-ob-surface/95 px-5 py-3.5 shadow-ob-md backdrop-blur"
    >
      <span className="flex items-center gap-2 text-sm font-semibold text-ob-ink">
        <span className="size-2 rounded-full bg-ob-warn" aria-hidden="true" />
        {error ? <span className="font-medium text-ob-danger">{error}</span> : "You have unsaved changes"}
      </span>
      <div className="flex gap-2">
        <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={onDiscard} disabled={saving}>
          Discard
        </button>
        <button type="button" className={button({ size: "sm" })} onClick={onSave} disabled={saving}>
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saveLabel}
        </button>
      </div>
    </div>
  );
}
