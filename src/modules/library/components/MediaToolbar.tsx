"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Select } from "@/components/kit/Select";
import { control, focusRing } from "@/components/kit/styles";
import type { MediaStatus, MediaType } from "@/core/media";
import { TYPE_META } from "../lib/display";

export type TypeFilter = "all" | MediaType;
export type StatusFilter = "all" | MediaStatus;

export interface MediaFilters {
  type: TypeFilter;
  status: StatusFilter;
  search: string;
}

const TYPES: TypeFilter[] = ["all", "image", "video", "carousel", "text"];

const STATUSES = [
  { value: "all", label: "Any status" },
  { value: "ready", label: "Ready" },
  { value: "generating", label: "Generating" },
  { value: "failed", label: "Failed" },
];

interface MediaToolbarProps {
  value: MediaFilters;
  onChange: (value: MediaFilters) => void;
  counts: Record<TypeFilter, number>;
}

/** Type pills with counts, a status filter and search. */
export function MediaToolbar({ value, onChange, counts }: MediaToolbarProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex flex-wrap gap-1.5 rounded-ob-md border border-ob-line bg-ob-surface p-1 shadow-ob-xs" role="tablist" aria-label="Filter by type">
        {TYPES.map((t) => {
          const on = value.type === t;
          const Icon = t === "all" ? null : TYPE_META[t].icon;
          return (
            <button
              key={t}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => onChange({ ...value, type: t })}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-ob px-3 py-1.5 text-[13.5px] font-semibold transition-colors duration-150",
                focusRing,
                on ? "bg-ob-dark text-ob-on-dark shadow-ob-sm" : "text-ob-muted hover:bg-ob-sunken hover:text-ob-ink"
              )}
            >
              {Icon && <Icon size={14} />}
              {t === "all" ? "All" : TYPE_META[t].plural}
              <span className={cn("rounded-full px-1.5 text-[11.5px] tabular-nums", on ? "bg-ob-on-dark/20" : "bg-ob-sunken text-ob-faint")}>{counts[t]}</span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1 lg:w-64 lg:flex-none">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ob-faint" aria-hidden="true" />
          <input
            type="search"
            aria-label="Search media"
            placeholder="Search ideas…"
            value={value.search}
            onChange={(e) => onChange({ ...value, search: e.target.value })}
            className={cn(control, "min-h-10 py-2 pl-9 pr-9 text-sm [&::-webkit-search-cancel-button]:hidden")}
          />
          {value.search && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange({ ...value, search: "" })}
              className={cn("absolute right-2 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-ob-muted hover:bg-ob-sunken", focusRing)}
            >
              <X size={14} />
            </button>
          )}
        </div>
        <Select
          aria-label="Filter by status"
          value={value.status}
          onValueChange={(v) => onChange({ ...value, status: v as StatusFilter })}
          options={STATUSES}
          className="min-h-10 w-40 py-2 text-sm"
        />
      </div>
    </div>
  );
}
