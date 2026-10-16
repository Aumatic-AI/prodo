"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: DialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={() => onOpenChange(false)} />
      <div
        className={cn(
          "relative w-full max-w-[520px] mx-4 rounded-xl bg-surface p-6 shadow-xl",
          "max-h-[85vh] overflow-y-auto",
          className
        )}
      >
        <button
          onClick={() => onOpenChange(false)}
          className="absolute top-4 right-4 text-secondary hover:text-text transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
        <h2 className="text-lg font-semibold text-text pr-8">{title}</h2>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
        <div className="mt-5">{children}</div>
      </div>
    </div>
  );
}
