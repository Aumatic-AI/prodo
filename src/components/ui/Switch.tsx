"use client";

import { cn } from "@/lib/utils";

interface SwitchProps {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  className?: string;
}

export function Switch({ checked, onCheckedChange, disabled, className }: SwitchProps) {
  return (
    <button
      role="switch"
      type="button"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-10 shrink-0 items-center rounded-full transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
        "disabled:opacity-50 disabled:pointer-events-none",
        className
      )}
      style={{ backgroundColor: checked ? "var(--color-primary)" : "var(--color-border)" }}
    >
      <span
        className="pointer-events-none block h-4 w-4 rounded-full bg-white shadow-sm transition-transform"
        style={{ transform: checked ? "translateX(20px)" : "translateX(4px)" }}
      />
    </button>
  );
}
