"use client";

import { ThumbsUp, MessageCircle, Repeat2, Send, Globe } from "lucide-react";
import { Avatar } from "./Avatar";
import type { PlatformPreviewProps } from "./types";

export function LinkedInPreview({ account, caption, mediaUrl, mediaType }: PlatformPreviewProps) {
  return (
    <div
      className="rounded-lg mx-auto p-4"
      style={{ maxWidth: 460, backgroundColor: "#fff", border: "1px solid #dce6f1" }}
    >
      <div className="flex items-center gap-2.5">
        <Avatar src={account.avatarUrl} name={account.displayName} size={48} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#000" }}>
            {account.displayName}
          </p>
          <div className="flex items-center gap-1" style={{ color: "#00000099" }}>
            <span className="text-xs">1h</span>
            <Globe className="w-3 h-3" />
          </div>
        </div>
      </div>

      {caption && (
        <p className="mt-3 text-sm whitespace-pre-wrap" style={{ color: "#000" }}>
          {caption}
        </p>
      )}

      {mediaUrl && (
        <div
          className="-mx-4 mt-3 bg-black/5 flex items-center justify-center overflow-hidden"
          style={{ borderTop: "1px solid #dce6f1" }}
        >
          {mediaType === "video" ? (
            <video src={mediaUrl} controls className="w-full" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="w-full" />
          )}
        </div>
      )}

      <div className="flex items-center justify-around pt-3 mt-3 border-t" style={{ borderColor: "#dce6f1" }}>
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Repeat2, label: "Repost" },
          { icon: Send, label: "Send" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 text-xs font-semibold" style={{ color: "#00000099" }}>
            <Icon className="w-4 h-4" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
