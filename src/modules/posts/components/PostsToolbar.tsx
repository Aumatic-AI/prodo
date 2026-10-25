"use client";

import { Search, X } from "lucide-react";
import { Select } from "@/components/kit/Select";
import { control, focusRing } from "@/components/kit/styles";
import { PLATFORMS } from "@/config/platforms";
import { cn } from "@/lib/utils";
import { POST_TABS, type PostTab } from "../lib/format";

const PLATFORM_OPTIONS = [{ value: "all", label: "All platforms" }, ...Object.entries(PLATFORMS).map(([value, p]) => ({ value, label: p.label }))];

interface PostsToolbarProps {
  tab: PostTab;
  onTab: (tab: PostTab) => void;
  counts: Record<PostTab, number>;
  search: string;
  onSearch: (value: string) => void;
  platform: string;
  onPlatform: (value: string) => void;
}

/** Status tabs with counts, a search box and a platform filter. */
export function PostsToolbar({ tab, onTab, counts, search, onSearch, platform, onPlatform }: PostsToolbarProps) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div role="tablist" aria-label="Post status" className="flex gap-1 overflow-x-auto rounded-ob-md border border-ob-line bg-ob-surface p-1 shadow-ob-xs">
        {POST_TABS.map((t) => {
          const active = t.value === tab;
          return (
            <button
              key={t.value}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onTab(t.value)}
              className={cn(
                "flex items-center gap-2 whitespace-nowrap rounded-ob px-3.5 py-2 text-sm font-semibold transition-colors duration-150",
                focusRing,
                active ? "bg-ob-primary text-ob-on-primary shadow-ob-sm" : "text-ob-muted hover:bg-ob-sunken hover:text-ob-ink"
              )}
            >
              {t.label}
              <span
                className={cn(
                  "min-w-5 rounded-full px-1.5 text-center text-[11.5px] font-bold tabular-nums",
                  active ? "bg-ob-on-primary/20 text-ob-on-primary" : t.value === "failed" && counts.failed ? "bg-ob-danger-soft text-ob-danger" : "bg-ob-sunken text-ob-muted"
                )}
              >
                {counts[t.value]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex gap-2.5">
        <label className="relative flex min-w-0 flex-1 items-center lg:w-72 lg:flex-none">
          <Search size={16} className="pointer-events-none absolute left-3.5 text-ob-faint" aria-hidden="true" />
          <input
            type="search"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search captions or accounts"
            aria-label="Search posts"
            className={cn(control, "min-h-10 py-2 pl-10 pr-9 text-sm [&::-webkit-search-cancel-button]:hidden")}
          />
          {search && (
            <button type="button" onClick={() => onSearch("")} aria-label="Clear search" className="absolute right-2.5 grid size-6 place-items-center rounded-full text-ob-muted hover:bg-ob-sunken">
              <X size={14} />
            </button>
          )}
        </label>
        <Select aria-label="Platform" value={platform} onValueChange={onPlatform} options={PLATFORM_OPTIONS} className="min-h-10 w-44 py-2 text-sm" />
      </div>
    </div>
  );
}
