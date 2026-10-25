"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "./styles";

export interface SectionNavItem<T extends string> {
  value: T;
  label: string;
  icon: LucideIcon;
  /** Small number on the right, e.g. items to confirm */
  count?: number;
  /** Count shown as something needing attention */
  alert?: boolean;
}

/** In-page navigation: a column on wide screens, a scrolling row on small ones. */
export function SectionNav<T extends string>({ items, value, onChange, label }: { items: SectionNavItem<T>[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <nav aria-label={label} className="flex gap-1 overflow-x-auto pb-1 lg:sticky lg:top-6 lg:flex-col lg:overflow-visible lg:pb-0">
      {items.map((item) => {
        const active = item.value === value;
        const Icon = item.icon;
        return (
          <button
            key={item.value}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(item.value)}
            className={cn(
              "flex shrink-0 items-center gap-2.5 rounded-ob px-3 py-2.5 text-left text-sm font-semibold transition-colors",
              focusRing,
              active ? "bg-ob-surface text-ob-primary shadow-ob-xs ring-1 ring-ob-line" : "text-ob-muted hover:bg-ob-surface/70 hover:text-ob-ink"
            )}
          >
            <Icon size={17} className="shrink-0" aria-hidden="true" />
            <span className="flex-1 whitespace-nowrap">{item.label}</span>
            {item.count != null && item.count > 0 && (
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", item.alert ? "bg-ob-warn-soft text-ob-warn" : "bg-ob-sunken text-ob-muted")}>{item.count}</span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
