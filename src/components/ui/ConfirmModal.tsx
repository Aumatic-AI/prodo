"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./Button";
import { X } from "lucide-react";

interface ConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  details?: ReactNode;
  confirmLabel?: string;
  variant?: "primary" | "danger";
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
}

export function ConfirmModal({
  open,
  onOpenChange,
  title,
  description,
  details,
  confirmLabel = "Confirm",
  variant = "primary",
  loading,
  error,
  onConfirm,
}: ConfirmModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={() => !loading && onOpenChange(false)}
      />
      <div
        className={cn(
          "relative w-full max-w-[420px] mx-4 rounded-xl bg-surface p-6 shadow-xl",
          "animate-in fade-in-0 zoom-in-95"
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          disabled={loading}
          className="absolute top-4 right-4 text-secondary hover:text-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        <h2 className="text-lg font-semibold text-text pr-8">{title}</h2>
        <p className="mt-2 text-sm text-muted">{description}</p>
        {details && <div className="mt-4">{details}</div>}
        {error && (
          <p className="mt-3 text-sm text-danger bg-danger-bg rounded-lg px-3 py-2">
            {error}
          </p>
        )}

        <div className="flex items-center justify-end gap-3 mt-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            variant={variant === "danger" ? "danger" : "primary"}
            size="sm"
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
