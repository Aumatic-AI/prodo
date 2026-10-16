"use client";

import { useState, useRef, useEffect } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, Check } from "lucide-react";

interface DropdownOption {
  value: string;
  label: string;
  disabled?: boolean;
}

interface DropdownProps {
  options: DropdownOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  id?: string;
  error?: string;
  className?: string;
  required?: boolean;
}

export function Dropdown({ options, value, onChange, placeholder, label, id, error, className, required }: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selected = options.find((o) => o.value === value);

  return (
    <div className={cn("flex flex-col gap-1.5", className)} ref={ref}>
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-text">
          {label}{required && <span className="text-danger ml-0.5">*</span>}
        </label>
      )}
      <div className="relative">
        <button
          id={id}
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={cn(
            "relative flex items-center w-full h-10 rounded-lg border text-left text-sm transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20",
            error ? "border-danger" : open ? "border-primary" : "border-default hover:border-strong",
          )}
          style={{ paddingLeft: 12, paddingRight: 36, backgroundColor: "var(--color-page)" }}
        >
          <span className={selected ? "text-text" : "text-secondary"}>
            {selected?.label || placeholder || "Select..."}
          </span>
          <ChevronDown
            className={cn(
              "absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-secondary transition-transform",
              open && "rotate-180"
            )}
          />
        </button>

        {open && (
          <div className="absolute z-50 top-full mt-1 left-0 right-0 max-h-60 overflow-y-auto rounded-lg border border-default bg-surface shadow-lg py-1.5">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                disabled={opt.disabled}
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={cn(
                  "flex items-center justify-between w-full px-3.5 py-2.5 text-sm text-left transition-colors",
                  opt.value === value ? "text-primary font-medium" : "text-text",
                  opt.disabled ? "opacity-40 pointer-events-none" : "hover:bg-surface-hover"
                )}
              >
                {opt.label}
                {opt.value === value && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
