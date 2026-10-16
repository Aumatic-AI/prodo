"use client";

import { cn } from "@/lib/utils";

interface Tab {
  value: string;
  label: string;
  count?: number;
}

interface TabsProps {
  tabs: Tab[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div className={cn("inline-flex items-center gap-1 p-1 rounded-lg bg-surface-sunken", className)}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          onClick={() => onChange(tab.value)}
          className={cn(
            "text-sm font-medium rounded-md transition-all",
            value === tab.value
              ? "bg-primary text-on-primary shadow-xs"
              : "text-muted hover:text-text"
          )}
          style={{ padding: "6px 14px" }}
        >
          {tab.label}
          {tab.count !== undefined && (
            <span className="ml-1.5 text-xs text-secondary">{tab.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
