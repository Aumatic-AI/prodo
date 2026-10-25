"use client";

import { Ellipsis, Globe, MessageCircle, Repeat2, Send, ThumbsUp } from "lucide-react";
import { Avatar } from "./Avatar";
import { Caption } from "./Caption";
import { MediaFrame } from "./MediaFrame";
import type { PlatformPreviewProps } from "./types";

export function LinkedInPreview({ account, caption, mediaUrls, mediaType }: PlatformPreviewProps) {
  return (
    <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-xl border border-neutral-200 bg-white text-neutral-900 shadow-ob-sm">
      <div className="flex items-start gap-2.5 px-4 pt-3.5">
        <Avatar src={account.avatarUrl} name={account.displayName} size={46} />
        <div className="min-w-0 flex-1">
          <p className="m-0 truncate text-sm font-semibold">{account.displayName}</p>
          <p className="m-0 text-xs text-neutral-500">1,032 followers</p>
          <p className="m-0 flex items-center gap-1 text-xs text-neutral-500">
            Now · <Globe size={11} />
          </p>
        </div>
        <Ellipsis size={20} className="text-neutral-500" />
      </div>
      {caption && (
        <div className="px-4 pt-3 text-sm leading-snug">
          <Caption text={caption} lines={3} linkClass="text-blue-700 font-semibold" />
        </div>
      )}
      {mediaType !== "text" && <MediaFrame urls={mediaUrls} type={mediaType} aspect={mediaType === "video" ? "9 / 16" : "1 / 1"} className="mt-3" />}
      <div className="px-4 py-2 text-xs text-neutral-500">👍💡 48 · 6 comments</div>
      <div className="mx-4 flex items-center justify-around border-t border-neutral-200 py-1.5">
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <span key={label} className="flex items-center gap-1.5 py-1.5 text-[13px] font-semibold text-neutral-500">
            <Icon size={16} /> {label}
          </span>
        ))}
      </div>
    </div>
  );
}
