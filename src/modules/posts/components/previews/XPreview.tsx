"use client";

import { BarChart2, Heart, MessageCircle, Repeat2, Share } from "lucide-react";
import { Avatar } from "./Avatar";
import { Caption } from "./Caption";
import { MediaFrame } from "./MediaFrame";
import type { PlatformPreviewProps } from "./types";

export function XPreview({ account, caption, mediaUrls, mediaType }: PlatformPreviewProps) {
  const handle = account.displayName.replace(/\s+/g, "").toLowerCase();
  return (
    <div className="mx-auto w-full max-w-[440px] rounded-xl border border-neutral-200 bg-white p-3.5 text-neutral-900 shadow-ob-sm">
      <div className="flex items-start gap-2.5">
        <Avatar src={account.avatarUrl} name={account.displayName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-[14.5px]">
            <span className="font-bold">{account.displayName}</span> <span className="text-neutral-500">@{handle} · 1m</span>
          </p>
          {caption && (
            <div className="mt-0.5 text-[14.5px] leading-snug">
              <Caption text={caption} lines={4} linkClass="text-sky-600" />
            </div>
          )}
          {mediaType !== "text" && mediaUrls.length > 0 && (
            <MediaFrame urls={mediaUrls} type={mediaType} aspect={mediaType === "video" ? "9 / 16" : "16 / 10"} className="mt-2.5 overflow-hidden rounded-2xl border border-neutral-200" />
          )}
          <div className="mt-3 flex max-w-[88%] items-center justify-between text-neutral-500">
            <MessageCircle size={17} />
            <Repeat2 size={17} />
            <Heart size={17} />
            <BarChart2 size={17} />
            <Share size={17} />
          </div>
        </div>
      </div>
    </div>
  );
}
