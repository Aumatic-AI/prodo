"use client";

import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { usePost } from "@/modules/posts/hooks/usePosts";
import { urlFor } from "@/providers/storage/supabase-storage";
import { ArrowLeft, ExternalLink, Pencil, Video, FileText } from "lucide-react";

export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: post, isLoading, error } = usePost(id);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48 rounded-lg" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (error || !post) {
    return <ErrorState message={error?.message || "Post not found"} onRetry={() => router.push("/posts")} />;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const media = post.media;
  const mediaUrl = media?.type === "image" && media.storage_key ? urlFor(supabaseUrl, media.storage_key) : null;
  const videoUrl = media?.type === "video" && media.storage_key ? urlFor(supabaseUrl, media.storage_key) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.push("/posts")} className="text-muted hover:text-text transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-text">Post detail</h1>
            <p className="mt-0.5 text-sm text-muted">Created {new Date(post.created_at).toLocaleDateString()}</p>
          </div>
        </div>
        {post.status === "draft" && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => router.push(`/posts/new?media=${post.media_id}&draft=${post.id}`)}
          >
            <Pencil className="w-4 h-4 mr-1.5" />
            Continue editing
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Media preview */}
          <div className="bg-surface rounded-xl border border-default shadow-xs p-5">
            <h3 className="text-sm font-semibold text-text mb-4">Media</h3>
            <div className="rounded-lg overflow-hidden bg-surface-sunken flex items-center justify-center" style={{ maxHeight: 420 }}>
              {mediaUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={mediaUrl} alt="" className="max-w-full max-h-[420px] object-contain" />
              ) : videoUrl ? (
                <video src={videoUrl} controls className="max-w-full max-h-[420px]" />
              ) : media?.type === "text" ? (
                <div className="p-5 text-sm text-text whitespace-pre-wrap w-full">
                  {media.content || media.idea}
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 py-12 text-secondary">
                  {media?.type === "video" ? <Video className="w-8 h-8" /> : <FileText className="w-8 h-8" />}
                  <p className="text-xs">No media available</p>
                </div>
              )}
            </div>
          </div>

          {/* Targets */}
          <div className="bg-surface rounded-xl border border-default shadow-xs p-5">
            <h3 className="text-sm font-semibold text-text mb-4">Accounts</h3>
            <div className="space-y-3">
              {post.post_targets.map((target) => {
                const row = (
                  <>
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <p className="text-sm font-medium text-text">{target.account_name}</p>
                        <p className="text-xs text-secondary capitalize">{target.platform}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusChip status={target.status} />
                      {target.url && <ExternalLink className="w-4 h-4 text-muted" />}
                    </div>
                  </>
                );

                return target.url ? (
                  <a
                    key={`${target.platform}-${target.account_id}`}
                    href={target.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-default hover:border-strong hover:bg-surface-hover transition-colors"
                  >
                    {row}
                  </a>
                ) : (
                  <div
                    key={`${target.platform}-${target.account_id}`}
                    className="flex items-center justify-between px-4 py-3 rounded-lg border border-default"
                  >
                    {row}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Captions */}
          <div className="bg-surface rounded-xl border border-default shadow-xs p-5">
            <h3 className="text-sm font-semibold text-text mb-4">Captions</h3>
            <div className="space-y-3">
              {post.post_targets.map((target) => (
                <div key={`caption-${target.platform}-${target.account_id}`}>
                  <p className="text-xs font-medium text-muted uppercase tracking-wide mb-1">{target.platform}</p>
                  <p className="text-sm text-text whitespace-pre-wrap">{target.caption || "No caption"}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-6">
          <div className="bg-surface rounded-xl border border-default shadow-xs p-5">
            <h3 className="text-sm font-semibold text-text mb-4">Status</h3>
            <StatusChip status={post.status} />
            {post.publish_at && (
              <p className="text-sm text-muted mt-3">
                Scheduled for {new Date(post.publish_at).toLocaleString()}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
