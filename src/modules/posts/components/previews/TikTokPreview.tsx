"use client";

import { Heart, MessageCircle, Share2, Plus } from "lucide-react";
import { Avatar } from "./Avatar";
import type { PlatformPreviewProps } from "./types";

export function TikTokPreview({ account, caption, mediaUrl }: PlatformPreviewProps) {
  return (
    <div
      className="relative mx-auto overflow-hidden rounded-2xl bg-black"
      style={{ maxWidth: 280, aspectRatio: "9 / 16" }}
    >
      {mediaUrl && (
        <video src={mediaUrl} autoPlay muted loop playsInline className="absolute inset-0 w-full h-full object-cover" />
      )}

      <div
        className="absolute inset-0"
        style={{ background: "linear-gradient(to top, rgba(0,0,0,0.75), rgba(0,0,0,0) 40%)" }}
      />

      {/* Action rail */}
      <div className="absolute flex flex-col items-center gap-4" style={{ right: 10, bottom: 64 }}>
        <div className="relative">
          <Avatar src={account.avatarUrl} name={account.displayName} size={44} />
          <div
            className="absolute flex items-center justify-center rounded-full"
            style={{
              bottom: -6,
              left: "50%",
              transform: "translateX(-50%)",
              width: 18,
              height: 18,
              backgroundColor: "#fe2c55",
              color: "#fff",
            }}
          >
            <Plus className="w-3 h-3" />
          </div>
        </div>
        <div className="flex flex-col items-center gap-1 text-white">
          <Heart className="w-7 h-7" />
          <span className="text-xs font-semibold">12.4K</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-white">
          <MessageCircle className="w-7 h-7" />
          <span className="text-xs font-semibold">284</span>
        </div>
        <div className="flex flex-col items-center gap-1 text-white">
          <Share2 className="w-7 h-7" />
          <span className="text-xs font-semibold">Share</span>
        </div>
      </div>

      {/* Caption block */}
      <div className="absolute text-white" style={{ left: 12, right: 64, bottom: 14 }}>
        <p className="text-sm font-bold truncate">{account.displayName}</p>
        {caption && <p className="text-xs mt-1 line-clamp-2">{caption}</p>}
        <p className="text-xs mt-1" style={{ opacity: 0.9 }}>
          ♪ original sound
        </p>
      </div>
    </div>
  );
}
