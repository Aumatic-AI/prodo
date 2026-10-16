"use client";

import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Send, Trash2, Eye } from "lucide-react";
import type { PostWithTargets } from "@/core/posts";

interface PostsTableProps {
  posts: PostWithTargets[] | undefined;
  isLoading: boolean;
  error: Error | null;
  onRefetch: () => void;
  onView: (id: string) => void;
  onDelete: (id: string) => void;
}

export function PostsTable({ posts, isLoading, error, onRefetch, onView, onDelete }: PostsTableProps) {
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

  return (
    <div className="overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="border-b border-[var(--color-border-subtle)] bg-surface-sunken">
            <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-4 py-2.5">Media</th>
            <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-4 py-2.5">Accounts</th>
            <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-4 py-2.5">Status</th>
            <th className="text-left text-xs font-medium text-secondary uppercase tracking-wider px-4 py-2.5">Scheduled</th>
            <th className="text-right text-xs font-medium text-secondary uppercase tracking-wider px-4 py-2.5">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-[var(--color-border-subtle)]">
          {posts.map((post) => (
            <tr key={post.id} className="hover:bg-surface-hover transition-colors">
              <td className="px-4 py-3 text-sm text-text">{post.media_id.slice(0, 8)}...</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1">
                  {post.post_targets.map((t) => (
                    <StatusChip key={t.id} status={t.status} className="text-[10px]" />
                  ))}
                </div>
              </td>
              <td className="px-4 py-3">
                <StatusChip status={post.status} />
              </td>
              <td className="px-4 py-3 text-sm text-muted">
                {post.publish_at
                  ? new Date(post.publish_at).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      hour: "numeric",
                      minute: "2-digit",
                    })
                  : "—"}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center justify-end gap-2">
                  <button onClick={() => onView(post.id)} className="p-1 text-muted hover:text-primary transition-colors" title="View">
                    <Eye className="w-4 h-4" />
                  </button>
                  <button onClick={() => onDelete(post.id)} className="p-1 text-muted hover:text-danger transition-colors" title="Delete">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
