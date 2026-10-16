"use client";

import { cn } from "@/lib/utils";

interface SegmentedOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SegmentedControlProps {
  options: SegmentedOption[];
  value: string;
  onChange: (value: string) => void;
  label?: string;
  className?: string;
  required?: boolean;
}

export function SegmentedControl({ options, value, onChange, label, className, required }: SegmentedControlProps) {
  return (
    <div className={className}>
      {label && <p className="text-sm font-medium text-text mb-2">{label}{required && <span className="text-danger ml-0.5">*</span>}</p>}
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={cn(
                "flex items-center gap-2 rounded-lg border text-sm font-medium transition-colors",
                selected
                  ? "border-primary text-primary"
                  : "border-default text-muted hover:text-text hover:border-strong"
              )}
              style={{
                padding: "8px 16px",
                ...(selected ? { backgroundColor: "var(--color-primary-subtle)" } : {}),
              }}
            >
              {opt.icon}
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
