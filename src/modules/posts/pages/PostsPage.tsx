"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Plus, Search, Send } from "lucide-react";
import { Alert } from "@/components/kit/Alert";
import { ConfirmDialog } from "@/components/kit/ConfirmDialog";
import { EmptyState } from "@/components/kit/EmptyState";
import { PageHeader } from "@/components/kit/PageHeader";
import { Skeleton } from "@/components/kit/Skeleton";
import { button } from "@/components/kit/styles";
import { PostCard } from "../components/PostCard";
import { PostsStats } from "../components/PostsStats";
import { PostsToolbar } from "../components/PostsToolbar";
import { useCancelPost, useDeletePost, usePosts } from "../hooks/usePosts";
import { groupByDay, inTab, POST_TABS, postTitle, type DayGroup, type PostRow, type PostTab } from "../lib/format";

function matches(post: PostRow, search: string, platform: string): boolean {
  if (platform !== "all" && !post.post_targets.some((t) => t.platform === platform || (platform === "twitter" && t.platform === "x"))) return false;
  if (!search.trim()) return true;
  const q = search.trim().toLowerCase();
  return [postTitle(post), ...post.post_targets.map((t) => `${t.account_name} ${t.caption}`)].some((s) => s.toLowerCase().includes(q));
}

function Section({ title, groups, onCancel, onDelete }: { title: string; groups: DayGroup[]; onCancel: (p: PostRow) => void; onDelete: (p: PostRow) => void }) {
  if (!groups.length) return null;
  return (
    <section className="flex flex-col gap-4">
      <h2 className="m-0 text-xs font-bold uppercase tracking-[0.08em] text-ob-faint">{title}</h2>
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-2.5">
          <div className="flex items-center gap-3">
            <span className="text-sm font-bold text-ob-ink">{g.label}</span>
            <span className="h-px flex-1 bg-ob-line" />
            <span className="text-xs font-semibold text-ob-faint">
              {g.posts.length} post{g.posts.length === 1 ? "" : "s"}
            </span>
          </div>
          {g.posts.map((p) => (
            <PostCard key={p.id} post={p} onCancel={onCancel} onDelete={onDelete} />
          ))}
        </div>
      ))}
    </section>
  );
}

/** Every post, grouped by day: what's coming up first, then what already went out. */
export function PostsPage() {
  const { data, isLoading, error } = usePosts();
  const posts = useMemo(() => (data ?? []) as PostRow[], [data]);
  const [tab, setTab] = useState<PostTab>("all");
  const [search, setSearch] = useState("");
  const [platform, setPlatform] = useState("all");
  const [cancelling, setCancelling] = useState<PostRow | null>(null);
  const [deleting, setDeleting] = useState<PostRow | null>(null);
  const cancel = useCancelPost();
  const remove = useDeletePost();

  const counts = useMemo(
    () => Object.fromEntries(POST_TABS.map((t) => [t.value, posts.filter((p) => inTab(p, t.value)).length])) as Record<PostTab, number>,
    [posts]
  );
  const shown = useMemo(() => posts.filter((p) => inTab(p, tab) && matches(p, search, platform)), [posts, tab, search, platform]);
  const { upcoming, earlier } = useMemo(() => groupByDay(shown), [shown]);
  const filtering = !!search.trim() || platform !== "all";

  const newPost = (
    <Link href="/media" className={button({ size: "sm" })}>
      <Plus size={16} /> New post
    </Link>
  );

  return (
    <div className="mx-auto flex max-w-[1240px] flex-col gap-6">
      <PageHeader title="Posts" description="Everything you've scheduled, published or saved, and how it went on each account." actions={newPost} />

      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : isLoading ? (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-[86px]" />
            ))}
          </div>
          <Skeleton className="mt-3 h-11" />
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-[100px]" />
          ))}
        </div>
      ) : !posts.length ? (
        <EmptyState
          icon={Send}
          title="No posts yet"
          description="Pick something from your media library, choose your accounts and write captions. Posts the agents schedule show up here too."
          action={
            <Link href="/media" className={button()}>
              <Plus size={16} /> Create your first post
            </Link>
          }
        />
      ) : (
        <>
          <PostsStats posts={posts} />
          <PostsToolbar tab={tab} onTab={setTab} counts={counts} search={search} onSearch={setSearch} platform={platform} onPlatform={setPlatform} />
          {!shown.length ? (
            <EmptyState
              icon={Search}
              title={filtering ? "No posts match" : "Nothing here yet"}
              description={filtering ? "Try another word or platform." : "Posts in this group will show up here."}
              action={
                filtering ? (
                  <button
                    type="button"
                    className={button({ variant: "secondary", size: "sm" })}
                    onClick={() => {
                      setSearch("");
                      setPlatform("all");
                    }}
                  >
                    Clear filters
                  </button>
                ) : undefined
              }
            />
          ) : (
            <div className="flex flex-col gap-8">
              <Section title="Coming up" groups={upcoming} onCancel={setCancelling} onDelete={setDeleting} />
              <Section title={upcoming.length ? "Earlier" : "Posts"} groups={earlier} onCancel={setCancelling} onDelete={setDeleting} />
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={!!cancelling}
        onOpenChange={(open) => !open && setCancelling(null)}
        title="Cancel this scheduled post?"
        description={<p className="m-0">It won&apos;t go out. The post goes back to your drafts, so you can edit it and schedule it again.</p>}
        confirmLabel="Cancel schedule"
        danger
        busy={cancel.isPending}
        error={cancel.error?.message}
        onConfirm={() => cancelling && cancel.mutate(cancelling.id, { onSuccess: () => setCancelling(null) })}
      />
      <ConfirmDialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="Delete this draft?"
        description={<p className="m-0">The draft and its captions are deleted. The media stays in your library.</p>}
        confirmLabel="Delete draft"
        danger
        busy={remove.isPending}
        error={remove.error?.message}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </div>
  );
}
