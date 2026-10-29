"use client";

import { POSTING_PLATFORMS, VIDEO_ONLY_PLATFORMS } from "@/core/onboarding/options";
import { Counter } from "@/components/kit/controls";
import { PlatformIcon } from "@/components/kit/PlatformIcon";
import { cn } from "@/lib/utils";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { POSTING_LABELS } from "../../config";

const videoOnly = (platform: string) => (VIDEO_ONLY_PLATFORMS as readonly string[]).includes(platform);

/** Posts per week on each platform. With images only, video-only platforms are off. */
export function PostingPlan({ imagesOnly }: { imagesOnly: boolean }) {
  const { value, update } = useSlice("content");
  const counts = value.postsPerWeek;
  const total = POSTING_PLATFORMS.filter((p) => !(imagesOnly && videoOnly(p))).reduce((sum, p) => sum + (counts[p] ?? 0), 0);

  return (
    <div className="flex flex-col divide-y divide-ob-line">
      {POSTING_PLATFORMS.map((platform) => {
        const blocked = imagesOnly && videoOnly(platform);
        return (
          <div key={platform} className="flex items-center justify-between gap-3 py-3">
            <span className={cn("flex items-center gap-2.5 font-semibold", blocked && "text-ob-faint")}>
              <span className={cn(blocked && "opacity-40")}>
                <PlatformIcon platform={platform} />
              </span>
              {POSTING_LABELS[platform]}
            </span>
            {blocked ? (
              <span className="text-[13px] text-ob-muted">Videos only on {POSTING_LABELS[platform]}</span>
            ) : (
              <Counter
                label={`${POSTING_LABELS[platform]} posts`}
                value={counts[platform] ?? 0}
                onChange={(n) => update("content", { postsPerWeek: { ...counts, [platform]: n } })}
              />
            )}
          </div>
        );
      })}
      <div className="flex items-center justify-between gap-3 py-3 font-bold">
        <span>Total</span>
        <span>{total} posts a week</span>
      </div>
    </div>
  );
}
