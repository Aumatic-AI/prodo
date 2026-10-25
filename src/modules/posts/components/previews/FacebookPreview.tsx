"use client";

import { Ellipsis, Globe, MessageCircle, Share2, ThumbsUp } from "lucide-react";
import { Avatar } from "./Avatar";
import { Caption } from "./Caption";
import { MediaFrame } from "./MediaFrame";
import type { PlatformPreviewProps } from "./types";

export function FacebookPreview({ account, caption, mediaUrls, mediaType }: PlatformPreviewProps) {
  return (
    <div className="mx-auto w-full max-w-[420px] overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-ob-sm">
      <div className="flex items-center gap-2.5 px-3 pb-2 pt-3">
        <Avatar src={account.avatarUrl} name={account.displayName} size={40} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-semibold">{account.displayName}</p>
          <p className="m-0 flex items-center gap-1 text-xs text-neutral-500">
            Just now · <Globe size={11} />
          </p>
        </div>
        <Ellipsis size={20} className="text-neutral-500" />
      </div>
      {caption && (
        <div className="px-3 pb-2.5 text-sm leading-snug">
          <Caption text={caption} lines={4} linkClass="text-blue-700" />
        </div>
      )}
      {mediaType !== "text" && <MediaFrame urls={mediaUrls} type={mediaType} aspect={mediaType === "video" ? "9 / 16" : "4 / 5"} />}
      <div className="flex items-center justify-between px-3 py-2 text-xs text-neutral-500">
        <span>👍❤️ 86</span>
        <span>12 comments · 4 shares</span>
      </div>
      <div className="mx-3 flex items-center justify-around border-t border-neutral-200 py-1.5">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share2, label: "Share" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-semibold text-neutral-500">
            <Icon size={17} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
