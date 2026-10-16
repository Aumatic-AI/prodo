"use client";

import { Button } from "./Button";

interface UnsavedChangesBarProps {
  show: boolean;
  loading?: boolean;
  onSave: () => void;
  onDiscard: () => void;
}

export function UnsavedChangesBar({
  show,
  loading,
  onSave,
  onDiscard,
}: UnsavedChangesBarProps) {
  if (!show) return null;

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40">
      <div className="flex items-center gap-4 px-5 py-3 rounded-xl bg-sidebar shadow-xl border border-white/10">
        <span className="text-sm text-white/80">You have unsaved changes</span>
        <button
          onClick={onDiscard}
          disabled={loading}
          className="text-sm font-medium rounded-md transition-colors disabled:opacity-50"
          style={{ padding: "6px 16px", color: "rgba(255,255,255,0.7)", background: "rgba(255,255,255,0.08)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "rgba(255,255,255,0.7)"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
        >
          Discard
        </button>
        <Button size="sm" onClick={onSave} loading={loading}>
          Save changes
        </Button>
      </div>
    </div>
  );
}
