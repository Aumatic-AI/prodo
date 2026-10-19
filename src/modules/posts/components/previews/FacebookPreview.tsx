"use client";

import { ThumbsUp, MessageCircle, Share2, Globe, Ellipsis } from "lucide-react";
import { Avatar } from "./Avatar";
import type { PlatformPreviewProps } from "./types";

export function FacebookPreview({ account, caption, mediaUrl, mediaType }: PlatformPreviewProps) {
  return (
    <div
      className="rounded-lg overflow-hidden mx-auto"
      style={{ maxWidth: 420, backgroundColor: "#fff", border: "1px solid #dadde1" }}
    >
      <div className="flex items-center gap-2.5 px-3 pt-3 pb-2">
        <Avatar src={account.avatarUrl} name={account.displayName} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate" style={{ color: "#050505" }}>
            {account.displayName}
          </p>
          <div className="flex items-center gap-1" style={{ color: "#65676b" }}>
            <span className="text-xs">Just now</span>
            <Globe className="w-3 h-3" />
          </div>
        </div>
        <Ellipsis className="w-5 h-5 shrink-0" style={{ color: "#65676b" }} />
      </div>

      {caption && (
        <p className="px-3 pb-2 text-sm whitespace-pre-wrap" style={{ color: "#050505" }}>
          {caption}
        </p>
      )}

      {mediaUrl && (
        <div className="bg-black/5 flex items-center justify-center" style={{ maxHeight: 420, overflow: "hidden" }}>
          {mediaType === "video" ? (
            <video src={mediaUrl} controls className="w-full" style={{ maxHeight: 420, objectFit: "cover" }} />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={mediaUrl} alt="" className="w-full" style={{ maxHeight: 420, objectFit: "cover" }} />
          )}
        </div>
      )}

      <div className="flex items-center justify-around px-2 py-1.5 border-t" style={{ borderColor: "#e4e6eb" }}>
        {[
          { icon: ThumbsUp, label: "Like" },
          { icon: MessageCircle, label: "Comment" },
          { icon: Share2, label: "Share" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold" style={{ color: "#65676b" }}>
            <Icon className="w-4 h-4" />
            {label}
          </div>
        ))}
      </div>
    </div>
  );
}
