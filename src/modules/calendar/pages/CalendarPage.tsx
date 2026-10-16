"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/Button";
import { StatusChip } from "@/components/ui/StatusChip";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { usePosts } from "@/modules/posts/hooks/usePosts";
import { cn } from "@/lib/utils";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

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

export function CalendarPage() {
  const [current, setCurrent] = useState(() => new Date());
  const year = current.getFullYear();
  const month = current.getMonth();
  const days = useMemo(() => getDaysInMonth(year, month), [year, month]);

  const { data: posts, isLoading, error, refetch } = usePosts();

  const postsByDay = useMemo(() => {
    const map = new Map<string, typeof posts>();
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
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrent(new Date(year, month - 1, 1))}
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCurrent(new Date())}
            >
              Today
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrent(new Date(year, month + 1, 1))}
            >
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
                <div key={d} className="px-3 py-2 text-xs font-medium text-secondary uppercase text-center" style={{ backgroundColor: "var(--color-page)" }}>
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

                return (
                  <div
                    key={key}
                    className={cn(
                      "min-h-[100px] border-b border-r border-[var(--color-border-subtle)] p-2",
                    )}
                    style={!day ? { backgroundColor: "var(--color-page)" } : undefined}
                  >
                    {day && (
                      <>
                        <span
                          className={cn(
                            "inline-flex items-center justify-center w-7 h-7 text-sm rounded-full",
                            isToday
                              ? "bg-primary text-on-primary font-semibold"
                              : "text-text"
                          )}
                        >
                          {day.getDate()}
                        </span>
                        {dayPosts?.map((p) => (
                          <div key={p.id} className="mt-1">
                            <StatusChip status={p.status} className="text-[10px]" />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
