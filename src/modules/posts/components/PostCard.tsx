"use client";

import Link from "next/link";
import { Ban, Bot, ExternalLink, Pencil, Trash2 } from "lucide-react";
import { Badge } from "@/components/kit/Badge";
import { button } from "@/components/kit/styles";
import { cn } from "@/lib/utils";
import { postTitle, whenLine, type PostRow } from "../lib/format";
import { PlatformMark } from "./PlatformMark";
import { PostStatusBadge } from "./PostStatusBadge";
import { PostThumb } from "./PostThumb";

interface PostCardProps {
  post: PostRow;
  onCancel: (post: PostRow) => void;
  onDelete: (post: PostRow) => void;
}

const action = cn(button({ variant: "quiet", size: "iconSm" }), "relative z-10");

/** One post as a row: thumbnail, caption, accounts with their status, time and quick actions. The whole card opens the post. */
export function PostCard({ post, onCancel, onDelete }: PostCardProps) {
  const liveUrl = post.post_targets.find((t) => t.url)?.url;
  const failed = post.post_targets.find((t) => t.status === "failed" && t.error);

  return (
    <article className="group relative flex items-center gap-4 rounded-ob-lg border border-ob-line bg-ob-surface p-3.5 shadow-ob-xs transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-ob-line-strong hover:shadow-ob-sm">
      <PostThumb media={post.media} className="size-[72px]" />

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
        <Link href={`/posts/${post.id}`} className="line-clamp-2 text-[14.5px] font-semibold leading-snug text-ob-ink after:absolute after:inset-0 after:rounded-ob-lg">
          {postTitle(post)}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <span className="text-[13px] text-ob-muted">{whenLine(post)}</span>
          {post.origin === "agent" && (
            <Badge tone="primary" size="sm">
              <Bot size={12} /> By Prodo
            </Badge>
          )}
        </div>
        {failed && <p className="m-0 line-clamp-1 text-[12.5px] text-ob-danger">{failed.error}</p>}
      </div>

      <div className="hidden items-center -space-x-1 sm:flex">
        {post.post_targets.map((t) => (
          <PlatformMark key={t.id} platform={t.platform} status={t.status} title={`${t.account_name} · ${t.status}`} />
        ))}
      </div>

      <div className="flex w-[148px] shrink-0 flex-col items-end gap-2">
        <PostStatusBadge status={post.status} />
        <div className="flex gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          {post.status === "draft" && (
            <>
              <Link href={`/posts/new?media=${post.media_id}&draft=${post.id}`} className={action} aria-label="Edit draft" title="Edit draft">
                <Pencil size={15} />
              </Link>
              <button type="button" className={cn(action, "hover:text-ob-danger")} aria-label="Delete draft" title="Delete draft" onClick={() => onDelete(post)}>
                <Trash2 size={15} />
              </button>
            </>
          )}
          {post.status === "scheduled" && (
            <button type="button" className={action} aria-label="Cancel schedule" title="Cancel schedule" onClick={() => onCancel(post)}>
              <Ban size={15} />
            </button>
          )}
          {liveUrl && (
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className={action} aria-label="View live post" title="View live post">
              <ExternalLink size={15} />
            </a>
          )}
        </div>
      </div>
    </article>
  );
}
