"use client";

import { Heart, MessageCircle, Music2, Plus, Share2, ThumbsDown, ThumbsUp } from "lucide-react";
import { Avatar } from "./Avatar";
import type { PlatformPreviewProps } from "./types";

/** Full-screen vertical video: TikTok, or YouTube Shorts with `shorts`. */
export function TikTokPreview({ account, caption, mediaUrls, mediaType, shorts }: PlatformPreviewProps & { shorts?: boolean }) {
  const url = mediaUrls[0];
  const actions = shorts
    ? [
        { icon: ThumbsUp, label: "2.1K" },
        { icon: ThumbsDown, label: "Dislike" },
        { icon: MessageCircle, label: "84" },
        { icon: Share2, label: "Share" },
      ]
    : [
        { icon: Heart, label: "12.4K" },
        { icon: MessageCircle, label: "284" },
        { icon: Share2, label: "Share" },
      ];

  return (
    <div className="relative mx-auto aspect-[9/16] w-full max-w-[290px] overflow-hidden rounded-[22px] bg-black shadow-ob-md ring-4 ring-neutral-900">
      {url &&
        (mediaType === "video" ? (
          <video src={url} autoPlay muted loop playsInline className="absolute inset-0 size-full object-cover" />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
        ))}
      <div className="absolute inset-0 bg-linear-to-t from-black/75 via-transparent to-black/20" />

      <div className="absolute bottom-16 right-2.5 flex flex-col items-center gap-4 text-white">
        {!shorts && (
          <span className="relative mb-1">
            <Avatar src={account.avatarUrl} name={account.displayName} size={42} className="ring-2 ring-white" />
            <span className="absolute -bottom-2 left-1/2 grid size-[18px] -translate-x-1/2 place-items-center rounded-full bg-rose-500">
              <Plus size={12} />
            </span>
          </span>
        )}
        {actions.map(({ icon: Icon, label }) => (
          <span key={label} className="flex flex-col items-center gap-1">
            <Icon size={26} />
            <span className="text-[11px] font-semibold">{label}</span>
          </span>
        ))}
      </div>

      <div className="absolute bottom-3.5 left-3 right-16 text-white">
        <p className="m-0 flex items-center gap-2 truncate text-sm font-bold">
          {shorts && <Avatar src={account.avatarUrl} name={account.displayName} size={24} />}
          {shorts ? `@${account.displayName.replace(/\s+/g, "").toLowerCase()}` : account.displayName}
        </p>
        {caption && <p className="m-0 mt-1 line-clamp-2 text-xs leading-snug">{caption}</p>}
        {!shorts && (
          <p className="m-0 mt-1.5 flex items-center gap-1 text-xs opacity-90">
            <Music2 size={12} /> original sound
          </p>
        )}
      </div>
      {shorts && <span className="absolute left-3 top-3 rounded bg-black/50 px-1.5 py-0.5 text-[11px] font-bold text-white">Shorts</span>}
    </div>
  );
}
