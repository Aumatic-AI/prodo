"use client";

import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { platformMeta } from "@/modules/dashboard/lib/platforms";
import { urlFor } from "@/providers/storage/supabase-storage";
import { Send, Video, FileText } from "lucide-react";
import type { PostWithTargets } from "@/core/posts";

interface PostsTableProps {
  posts: PostWithTargets[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  onView: (id: string) => void;
}

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function PostsTable({ posts, isLoading, error, onRefetch, onView }: PostsTableProps) {
  if (isLoading) {
    return (
      <div className="divide-y divide-[var(--color-border-subtle)]">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-10 w-10 rounded-lg" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-20 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (error) return <ErrorState message="Failed to load posts" onRetry={onRefetch} />;

  if (!posts?.length) {
    return (
      <EmptyState
        icon={Send}
        title="No posts yet"
        description="Create a post from your media library to get started."
      />
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

  return (
    <div className="overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)] bg-surface-sunken">
            <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-4 py-2.5">Post</th>
            <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-4 py-2.5">Accounts</th>
            <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-4 py-2.5">Status</th>
            <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-4 py-2.5">Created</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {posts.map((post) => {
            const media = post.media;
            const imageUrl = media?.type === "image" && media.storage_key ? urlFor(supabaseUrl, media.storage_key) : null;

            return (
              <tr
                key={post.id}
                onClick={() => onView(post.id)}
                className="hover:bg-surface-hover transition-colors cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="w-10 h-10 rounded-lg overflow-hidden bg-surface-sunken flex items-center justify-center shrink-0">
                    {imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={imageUrl} alt="" className="w-full h-full object-cover" />
                    ) : media?.type === "video" ? (
                      <Video className="w-4 h-4 text-secondary" />
                    ) : (
                      <FileText className="w-4 h-4 text-secondary" />
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    {post.post_targets.map((t) => {
                      const meta = platformMeta(t.platform);
                      const Icon = meta?.icon;
                      const badge = (
                        <div
                          className="w-7 h-7 rounded-md flex items-center justify-center"
                          style={{ backgroundColor: meta?.color || "var(--color-surface-sunken)" }}
                          title={`${t.account_name} (${meta?.label || t.platform}) — ${t.status}`}
                        >
                          {Icon ? <Icon className="w-3.5 h-3.5 text-white" /> : null}
                        </div>
                      );
                      return t.url ? (
                        <a
                          key={t.id}
                          href={t.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {badge}
                        </a>
                      ) : (
                        <div key={t.id}>{badge}</div>
                      );
                    })}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <StatusChip status={post.status} />
                  {post.status === "scheduled" && post.publish_at && (
                    <p className="text-xs text-muted mt-1">{formatDateTime(post.publish_at)}</p>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-muted">{formatDateTime(post.created_at)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
