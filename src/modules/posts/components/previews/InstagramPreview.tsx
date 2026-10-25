"use client";

import { Bookmark, Ellipsis, Heart, MessageCircle, Send } from "lucide-react";
import { Avatar } from "./Avatar";
import { Caption } from "./Caption";
import { MediaFrame } from "./MediaFrame";
import type { PlatformPreviewProps } from "./types";

export function InstagramPreview({ account, caption, mediaUrls, mediaType }: PlatformPreviewProps) {
  const handle = account.displayName.replace(/^@/, "").replace(/\s+/g, "").toLowerCase();
  return (
    <div className="mx-auto w-full max-w-[380px] overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-ob-sm">
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <span className="rounded-full bg-linear-to-tr from-amber-400 via-pink-500 to-purple-600 p-[2px]">
          <Avatar src={account.avatarUrl} name={handle} size={30} className="ring-2 ring-white" />
        </span>
        <span className="flex-1 truncate text-[13.5px] font-semibold">{handle}</span>
        <Ellipsis size={18} />
      </div>
      <MediaFrame urls={mediaUrls} type={mediaType} aspect={mediaType === "video" ? "9 / 16" : "4 / 5"} dots="below" />
      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <Heart size={22} />
        <MessageCircle size={22} className="-scale-x-100" />
        <Send size={22} />
        <Bookmark size={22} className="ml-auto" />
      </div>
      <p className="m-0 px-3 pt-2 text-[13.5px] font-semibold">1,204 likes</p>
      {caption && (
        <div className="px-3 pt-1 text-[13.5px] leading-snug">
          <Caption text={caption} prefix={handle} lines={2} />
        </div>
      )}
      <p className="m-0 px-3 pb-3 pt-1.5 text-[11px] uppercase tracking-wide text-neutral-400">Just now</p>
    </div>
  );
}
