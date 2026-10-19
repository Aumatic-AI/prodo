"use client";

import { Heart, MessageCircle, Send, Bookmark, Ellipsis } from "lucide-react";
import { Avatar } from "./Avatar";
import type { PlatformPreviewProps } from "./types";

export function InstagramPreview({ account, caption, mediaUrl, mediaType }: PlatformPreviewProps) {
  const handle = account.displayName.replace(/^@/, "");

  return (
    <div
      className="rounded-sm overflow-hidden mx-auto"
      style={{ maxWidth: 380, backgroundColor: "#fff", border: "1px solid #dbdbdb" }}
    >
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <div style={{ padding: 2, borderRadius: "9999px", border: "1px solid #dbdbdb" }}>
          <Avatar src={account.avatarUrl} name={handle} size={28} />
        </div>
        <p className="flex-1 text-sm font-semibold truncate" style={{ color: "#262626" }}>
          {handle}
        </p>
        <Ellipsis className="w-4 h-4" style={{ color: "#262626" }} />
      </div>

      <div className="relative bg-black/5" style={{ aspectRatio: "1 / 1" }}>
        {mediaUrl ? (
          mediaType === "video" ? (
            <video src={mediaUrl} controls className="w-full h-full" style={{ objectFit: "cover" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="w-full h-full" style={{ objectFit: "cover" }} />
          )
        ) : null}
      </div>

      <div className="flex items-center gap-3.5 px-3 pt-2.5">
        <Heart className="w-6 h-6" style={{ color: "#262626" }} />
        <MessageCircle className="w-6 h-6 scale-x-[-1]" style={{ color: "#262626" }} />
        <Send className="w-6 h-6" style={{ color: "#262626" }} />
        <Bookmark className="w-6 h-6 ml-auto" style={{ color: "#262626" }} />
      </div>

      <p className="px-3 pt-2 text-sm font-semibold" style={{ color: "#262626" }}>
        1,204 likes
      </p>

      {caption && (
        <p className="px-3 pt-1 text-sm whitespace-pre-wrap" style={{ color: "#262626" }}>
          <span className="font-semibold mr-1.5">{handle}</span>
          {caption}
        </p>
      )}

      <p className="px-3 pt-1.5 pb-3 text-xs uppercase" style={{ color: "#8e8e8e" }}>
        2 hours ago
      </p>
    </div>
  );
}
