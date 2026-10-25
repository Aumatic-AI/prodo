"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Ban, Bot, CalendarClock, LayoutGrid, Pencil, Repeat, Trash2 } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { cn } from "@/lib/utils";
import { TargetTimeline } from "../components/detail/TargetTimeline";
import { PlatformMark } from "../components/PlatformMark";
import { PostStatusBadge } from "../components/PostStatusBadge";
import { PlatformPreview } from "../components/previews";
import { useCancelPost, useDeletePost, usePost, usePostMedia } from "../hooks/usePosts";
import { dayLabel, isUpcoming, platformsOf, postTitle, relative, timeOfDay, type PostRow } from "../lib/format";
import { mediaUrls, previewType } from "../lib/media-urls";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-[13.5px]">
      <span className="text-ob-muted">{label}</span>
      <span className="text-right font-semibold text-ob-ink">{children}</span>
    </div>
  );
}

const at = (iso: string) => `${dayLabel(new Date(iso))}, ${timeOfDay(new Date(iso))}`;

/** One post: how it looks, how it went on each account, and what you can still do with it. */
export function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data, isLoading, error } = usePost(id);
  const post = data as PostRow | undefined;
  const { data: media } = usePostMedia(post?.media_id ?? null);
  const cancel = useCancelPost();
  const remove = useDeletePost();
  const [platform, setPlatform] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"cancel" | "delete" | null>(null);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
        <Skeleton className="h-16 w-96" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <Skeleton className="h-[520px]" />
          <Skeleton className="h-72" />
        </div>
      </div>
    );
  }
  if (error || !post) return <Alert tone="error">{error?.message ?? "This post doesn't exist any more."}</Alert>;

  const platforms = platformsOf(post);
  const current = platform && platforms.includes(platform) ? platform : (platforms[0] ?? "instagram");
  const target = post.post_targets.find((t) => t.platform === current);
  const live = post.post_targets.filter((t) => t.status === "published").length;

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader
        eyebrow="Post"
        title={<span className="line-clamp-2 text-[24px]">{postTitle(post)}</span>}
        actions={
          <Link href="/posts" className={button({ variant: "secondary", size: "sm" })}>
            <ArrowLeft size={15} /> Posts
          </Link>
        }
      />

      {post.plan_item_id && (
        <Alert tone="info">
          <span className="flex flex-wrap items-center gap-x-2">
            <Bot size={15} /> Prodo made this post for this week&apos;s plan.
            <Link href="/week" className="inline-flex items-center gap-1 font-semibold underline">
              <LayoutGrid size={13} /> Open the plan
            </Link>
          </span>
        </Alert>
      )}

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="flex flex-col gap-4 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="m-0 text-[17px] font-bold tracking-tight">How it looks</h2>
              <div className="flex gap-1">
                {platforms.map((p) => (
                  <button
                    key={p}
                    type="button"
                    aria-label={`Show on ${p}`}
                    onClick={() => setPlatform(p)}
                    className={cn("rounded-ob transition-opacity", p === current ? "opacity-100" : "opacity-40 hover:opacity-80")}
                  >
                    <PlatformMark platform={p} />
                  </button>
                ))}
              </div>
            </div>
            <div className="rounded-ob-md bg-linear-to-b from-ob-sunken to-ob-bg px-4 py-8">
              <PlatformPreview
                platform={current}
                account={{ displayName: target?.account_name ?? "your_brand" }}
                caption={target?.caption ?? ""}
                mediaUrls={mediaUrls(media)}
                mediaType={previewType(media ?? null) ?? post.media?.type}
              />
            </div>
          </section>

          <section className="flex flex-col gap-4">
            <div className="flex items-baseline justify-between">
              <h2 className="m-0 text-[17px] font-bold tracking-tight">Accounts</h2>
              <span className="text-[13px] text-ob-muted">
                {live} of {post.post_targets.length} live
              </span>
            </div>
            <ul className="m-0 flex list-none flex-col gap-3 p-0">
              {post.post_targets.map((t) => (
                <TargetTimeline key={t.id} target={t} />
              ))}
            </ul>
          </section>
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
          <section className="flex flex-col gap-3.5 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
            {isUpcoming(post) && post.publish_at && (
              <div className="flex items-center gap-3 rounded-ob-md bg-ob-primary-soft p-3.5 text-ob-primary-ink">
                <CalendarClock size={22} className="shrink-0" />
                <div className="flex flex-col">
                  <span className="text-sm font-bold">{at(post.publish_at)}</span>
                  <span className="text-xs">Goes out {relative(new Date(post.publish_at))}</span>
                </div>
              </div>
            )}
            <Fact label="Status">
              <PostStatusBadge status={post.status} />
            </Fact>
            {post.publish_at && !isUpcoming(post) && <Fact label="Planned for">{at(post.publish_at)}</Fact>}
            <Fact label="Made">{at(post.created_at)}</Fact>
            <Fact label="By">{post.origin === "agent" ? "Prodo" : "You"}</Fact>
            <Fact label="Media">{post.media?.type ?? "—"}</Fact>
          </section>

          <section className="flex flex-col gap-2 rounded-ob-lg border border-ob-line bg-ob-surface p-5 shadow-ob-xs">
            <h2 className="m-0 mb-1 text-sm font-bold text-ob-ink">Actions</h2>
            {post.status === "draft" && (
              <>
                <Link href={`/posts/new?media=${post.media_id}&draft=${post.id}`} className={button({ size: "sm" })}>
                  <Pencil size={15} /> Continue editing
                </Link>
                <button type="button" className={button({ variant: "danger", size: "sm" })} onClick={() => setConfirm("delete")}>
                  <Trash2 size={15} /> Delete draft
                </button>
              </>
            )}
            {post.status === "scheduled" && (
              <button type="button" className={button({ variant: "secondary", size: "sm" })} onClick={() => setConfirm("cancel")}>
                <Ban size={15} /> Cancel schedule
              </button>
            )}
            {post.status !== "draft" && (
              <Link href={`/posts/new?media=${post.media_id}`} className={button({ variant: post.status === "failed" ? "primary" : "secondary", size: "sm" })}>
                <Repeat size={15} /> {post.status === "failed" ? "Try again as a new post" : "Post this again"}
              </Link>
            )}
          </section>
        </aside>
      </div>

      <ConfirmDialog
        open={confirm === "cancel"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Cancel this scheduled post?"
        description={<p className="m-0">It won&apos;t go out. The post goes back to your drafts, so you can edit it and schedule it again.</p>}
        confirmLabel="Cancel schedule"
        danger
        busy={cancel.isPending}
        error={cancel.error?.message}
        onConfirm={() => cancel.mutate(post.id, { onSuccess: () => setConfirm(null) })}
      />
      <ConfirmDialog
        open={confirm === "delete"}
        onOpenChange={(open) => !open && setConfirm(null)}
        title="Delete this draft?"
        description={<p className="m-0">The draft and its captions are deleted. The media stays in your library.</p>}
        confirmLabel="Delete draft"
        danger
        busy={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => remove.mutate(post.id, { onSuccess: () => router.push("/posts") })}
      />
    </div>
  );
}
