"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Tabs } from "@/components/ui/Tabs";
import { PostsTable } from "../components/PostsTable";
import { usePosts } from "../hooks/usePosts";
import { Plus } from "lucide-react";

const TABS = [
  { value: "all", label: "All" },
  { value: "published", label: "Published" },
  { value: "scheduled", label: "Scheduled" },
  { value: "draft", label: "Drafts" },
  { value: "failed", label: "Failed" },
];

export function PostsPage() {
  const router = useRouter();
  const { data: posts, isLoading, error, refetch } = usePosts();
  const [tab, setTab] = useState("all");

  const filtered = useMemo(() => {
    if (!posts || tab === "all") return posts;
    return posts.filter((p) => p.status === tab);
  }, [posts, tab]);

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Posts</h1>
          <p className="mt-1 text-sm text-muted">Every post with its status per account.</p>
        </div>
        <Button size="sm" onClick={() => router.push("/posts/new")}>
          <Plus className="w-4 h-4" />
          New post
        </Button>
      </div>

      <div className="bg-surface rounded-xl border border-default shadow-xs py-6">
        <div className="mb-6 px-6">
          <Tabs tabs={TABS} value={tab} onChange={setTab} />
        </div>

        <PostsTable
          posts={filtered}
          isLoading={isLoading}
          error={error}
          onRefetch={refetch}
          onView={(id) => router.push(`/posts/${id}`)}
        />
      </div>
    </div>
  );
}
