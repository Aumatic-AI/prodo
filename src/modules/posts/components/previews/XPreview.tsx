"use client";

import { MessageCircle, Repeat2, Heart, BarChart2, Share } from "lucide-react";
import { Avatar } from "./Avatar";
import type { PlatformPreviewProps } from "./types";

export function XPreview({ account, caption, mediaUrl, mediaType }: PlatformPreviewProps) {
  return (
    <div
      className="rounded-2xl overflow-hidden mx-auto p-3"
      style={{ maxWidth: 420, backgroundColor: "#000", color: "#fff", border: "1px solid #2f3336" }}
    >
      <div className="flex items-start gap-2.5">
        <Avatar src={account.avatarUrl} name={account.displayName} size={40} />
        <div className="flex-1 min-w-0">
          <p className="text-sm">
            <span className="font-bold">{account.displayName}</span>{" "}
            <span style={{ color: "#71767b" }}>· 1m</span>
          </p>

          {caption && <p className="mt-0.5 text-sm whitespace-pre-wrap">{caption}</p>}

          {mediaUrl && (
            <div className="mt-2.5 rounded-2xl overflow-hidden" style={{ border: "1px solid #2f3336" }}>
              {mediaType === "video" ? (
                <video src={mediaUrl} controls className="w-full" />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="" className="w-full" />
              )}
            </div>
          )}

          <div className="flex items-center justify-between mt-3" style={{ maxWidth: "80%", color: "#71767b" }}>
            <MessageCircle className="w-[18px] h-[18px]" />
            <Repeat2 className="w-[18px] h-[18px]" />
            <Heart className="w-[18px] h-[18px]" />
            <BarChart2 className="w-[18px] h-[18px]" />
            <Share className="w-[18px] h-[18px]" />
          </div>
        </div>
      </div>
    </div>
  );
}
