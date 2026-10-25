"use client";

import Link from "next/link";
import { Check, Plus } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { Skeleton } from "@/components/kit/Skeleton";
import { button, focusRing } from "@/components/kit/styles";
import { platformMeta } from "@/config/platforms";
import type { MediaType } from "@/core/media";
import { cn } from "@/lib/utils";
import type { ConnectedAccount } from "@/providers/publishing/types";
import { PlatformMark } from "../PlatformMark";
import { Avatar } from "../previews/Avatar";

/** Why an account can't take this media, or null when it can. */
export function unsupportedReason(platform: string, type: MediaType | undefined): string | null {
  const meta = platformMeta(platform);
  if ((type === "image" || type === "carousel") && !meta.supportsImages) return "Videos only";
  if (type === "video" && !meta.supportsVideos) return "No videos";
  if (type === "text" && (platform === "instagram" || platform === "tiktok" || platform === "youtube")) return "Needs media";
  return null;
}

interface AccountPickerProps {
  accounts: ConnectedAccount[] | undefined;
  loading: boolean;
  error: Error | null;
  selected: Set<string>;
  onToggle: (id: string) => void;
  mediaType: MediaType | undefined;
}

/** Connected accounts as cards: picture, platform and a check when picked. */
export function AccountPicker({ accounts, loading, error, selected, onToggle, mediaType }: AccountPickerProps) {
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (loading)
    return (
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2.5">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} className="h-[68px]" />
        ))}
      </div>
    );
  if (!accounts?.length)
    return (
      <div className="flex flex-col items-start gap-3 rounded-ob-md border border-dashed border-ob-line-strong p-5">
        <p className="m-0 text-sm text-ob-muted">No accounts connected yet. Connect Instagram, Facebook, LinkedIn and more in a minute.</p>
        <Link href="/settings?tab=accounts" className={button({ size: "sm" })}>
          <Plus size={15} /> Connect accounts
        </Link>
      </div>
    );

  return (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(210px,1fr))] gap-2.5">
      {accounts.map((a) => {
        const on = selected.has(a.id);
        const blocked = unsupportedReason(a.platform, mediaType);
        return (
          <button
            key={a.id}
            type="button"
            aria-pressed={on}
            disabled={!!blocked && !on}
            onClick={() => onToggle(a.id)}
            className={cn(
              "relative flex items-center gap-3 rounded-ob-md border p-3 text-left transition-[border-color,background-color,box-shadow,transform] duration-150",
              focusRing,
              on ? "border-ob-primary bg-ob-primary-soft shadow-ob-sm" : "border-ob-line bg-ob-surface enabled:hover:-translate-y-px enabled:hover:border-ob-line-strong",
              blocked && !on && "cursor-not-allowed opacity-50"
            )}
          >
            <span className="relative">
              <Avatar src={a.avatarUrl} name={a.name} size={40} />
              <span className="absolute -bottom-1 -right-1 scale-[0.72]">
                <PlatformMark platform={a.platform} />
              </span>
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-bold text-ob-ink">{a.name}</span>
              <span className="truncate text-xs text-ob-muted">{blocked ?? platformMeta(a.platform).label}</span>
            </span>
            <span
              className={cn(
                "grid size-5 shrink-0 place-items-center rounded-full border-2 transition-colors",
                on ? "border-ob-primary bg-ob-primary text-ob-on-primary" : "border-ob-line-strong"
              )}
            >
              {on && <Check size={12} strokeWidth={3} />}
            </span>
          </button>
        );
      })}
    </div>
  );
}
