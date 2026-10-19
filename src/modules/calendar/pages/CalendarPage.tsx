"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Dialog } from "@/components/ui/Dialog";
import { ChevronLeft, ChevronRight, Video, FileText } from "lucide-react";
import { usePosts } from "@/modules/posts/hooks/usePosts";
import { platformMeta } from "@/modules/dashboard/lib/platforms";
import { urlFor } from "@/providers/storage/supabase-storage";
import { cn } from "@/lib/utils";
import type { PostWithTargets } from "@/core/posts";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_VISIBLE_PER_DAY = 2;

function getDaysInMonth(year: number, month: number) {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const days: (Date | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= lastDay.getDate(); d++) {
    days.push(new Date(year, month, d));
  }
  return days;
}

function thumbUrlFor(post: PostWithTargets, supabaseUrl: string): string | null {
  const media = post.media;
  if (media?.type === "image" && media.storage_key) return urlFor(supabaseUrl, media.storage_key);
  return null;
}

function PostThumb({ post, supabaseUrl, size = "w-5 h-5" }: { post: PostWithTargets; supabaseUrl: string; size?: string }) {
  const thumb = thumbUrlFor(post, supabaseUrl);
  return (
    <div className={cn(size, "rounded shrink-0 overflow-hidden bg-surface-sunken flex items-center justify-center")}>
      {thumb ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={thumb} alt="" className="w-full h-full object-cover" />
      ) : post.media?.type === "video" ? (
        <Video className="w-3 h-3 text-secondary" />
      ) : (
        <FileText className="w-3 h-3 text-secondary" />
      )}
    </div>
  );
}

function PlatformBadges({ platforms, size = "w-3.5 h-3.5" }: { platforms: string[]; size?: string }) {
  return (
    <div className="flex items-center gap-0.5 shrink-0">
      {platforms.slice(0, 3).map((platform) => {
        const meta = platformMeta(platform);
        const Icon = meta?.icon;
        if (!Icon) return null;
        return (
          <div
            key={platform}
            className={cn(size, "rounded-sm flex items-center justify-center")}
            style={{ backgroundColor: meta?.color }}
          >
            <Icon className="w-2 h-2 text-white" />
          </div>
        );
      })}
    </div>
  );
}

export function CalendarPage() {
  const router = useRouter();
  const [current, setCurrent] = useState(() => new Date());
  const year = current.getFullYear();
  const month = current.getMonth();
  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const { data: posts, isLoading, error, refetch } = usePosts();

  const postsByDay = useMemo(() => {
    const map = new Map<string, PostWithTargets[]>();
    posts?.forEach((p) => {
      const d = p.publish_at ? new Date(p.publish_at).toDateString() : null;
      if (d) {
        const existing = map.get(d) || [];
        existing.push(p);
        map.set(d, existing);
      }
    });
    return map;
  }, [posts]);

  const today = new Date().toDateString();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const selectedDayPosts = selectedDay ? postsByDay.get(selectedDay.toDateString()) || [] : [];

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-text">Calendar</h1>
        <p className="mt-1 text-sm text-muted">Your scheduled and published posts on a timeline.</p>
      </div>

      <div className="bg-surface rounded-xl border border-default shadow-xs p-6">
        {/* Month navigation */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-text">
            {current.toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </h2>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={() => setCurrent(new Date(year, month - 1, 1))}>
              <ChevronLeft />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setCurrent(new Date())}>
              Today
            </Button>
            <Button variant="ghost" size="icon" onClick={() => setCurrent(new Date(year, month + 1, 1))}>
              <ChevronRight />
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Skeleton className="h-[500px] rounded-xl" />
        ) : error ? (
          <ErrorState message="Failed to load calendar" onRetry={refetch} />
        ) : (
          <div className="rounded-lg border border-default overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 border-b border-[var(--color-border-subtle)]">
              {DAYS.map((d) => (
                <div
                  key={d}
                  className="px-3 py-2 text-xs font-medium text-secondary uppercase text-center"
                  style={{ backgroundColor: "var(--color-page)" }}
                >
                  {d}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {days.map((day, i) => {
                const key = day?.toDateString() || `empty-${i}`;
                const isToday = day?.toDateString() === today;
                const dayPosts = day ? postsByDay.get(day.toDateString()) : undefined;
                const visiblePosts = dayPosts?.slice(0, MAX_VISIBLE_PER_DAY) || [];
                const extraCount = (dayPosts?.length || 0) - visiblePosts.length;
                const clickable = !!(day && dayPosts?.length);

                return (
                  <div
                    key={key}
                    onClick={() => clickable && setSelectedDay(day)}
                    className={cn(
                      "min-h-[116px] border-b border-r border-[var(--color-border-subtle)] p-2",
                      clickable && "cursor-pointer hover:bg-surface-hover transition-colors"
                    )}
                    style={!day ? { backgroundColor: "var(--color-page)" } : undefined}
                  >
                    {day && (
                      <>
                        <span
                          className={cn(
                            "inline-flex items-center justify-center w-7 h-7 text-sm rounded-full",
                            isToday ? "bg-primary text-on-primary font-semibold" : "text-text"
                          )}
                        >
                          {day.getDate()}
                        </span>

                        <div className="mt-1.5 space-y-1">
                          {visiblePosts.map((p) => {
                            const platforms = [...new Set(p.post_targets.map((t) => t.platform))];
                            return (
                              <div
                                key={p.id}
                                className="flex items-center gap-1.5 rounded-md bg-page"
                                style={{ padding: "4px 6px" }}
                              >
                                <PostThumb post={p} supabaseUrl={supabaseUrl} />
                                <PlatformBadges platforms={platforms} />
                                <StatusChip status={p.status} className="text-[9px] px-1 py-0 ml-auto shrink-0" />
                              </div>
                            );
                          })}
                          {extraCount > 0 && <p className="text-[10px] text-muted px-1">+{extraCount} more</p>}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <Dialog
        open={!!selectedDay}
        onOpenChange={(open) => !open && setSelectedDay(null)}
        title={
          selectedDay
            ? selectedDay.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })
            : ""
        }
      >
        <div className="space-y-2">
          {selectedDayPosts.map((p) => {
            const platforms = [...new Set(p.post_targets.map((t) => t.platform))];
            return (
              <button
                key={p.id}
                onClick={() => router.push(`/posts/${p.id}`)}
                className="flex items-center gap-3 w-full rounded-lg border border-default hover:bg-surface-hover transition-colors text-left"
                style={{ padding: "10px 12px" }}
              >
                <PostThumb post={p} supabaseUrl={supabaseUrl} size="w-10 h-10" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text truncate">{p.media?.idea || p.media?.content || "Untitled post"}</p>
                  <div className="mt-1">
                    <PlatformBadges platforms={platforms} size="w-4 h-4" />
                  </div>
                </div>
                <StatusChip status={p.status} />
              </button>
            );
          })}
        </div>
      </Dialog>
    </div>
  );
}
