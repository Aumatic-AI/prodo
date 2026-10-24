"use client";

import { POSTING_PLATFORMS } from "@/core/onboarding/options";
import { Counter } from "@/components/kit/controls";
import { PlatformIcon } from "@/components/kit/PlatformIcon";
import { useSlice } from "../../store/OnboardingStoreProvider";
import { POSTING_LABELS } from "../../config";

export function PostingPlan() {
  const { value, update } = useSlice("style");
  const total = Object.values(value.postsPerWeek).reduce((sum, n) => sum + (n ?? 0), 0);

  return (
    <div className="flex flex-col divide-y divide-ob-line">
      {POSTING_PLATFORMS.map((platform) => (
        <div key={platform} className="flex items-center justify-between gap-3 py-3">
          <span className="flex items-center gap-2.5 font-semibold">
            <PlatformIcon platform={platform} />
            {POSTING_LABELS[platform]}
          </span>
          <Counter
            label={`${POSTING_LABELS[platform]} posts`}
            value={value.postsPerWeek[platform] ?? 0}
            onChange={(n) => update("style", { postsPerWeek: { ...value.postsPerWeek, [platform]: n } })}
          />
        </div>
      ))}
      <div className="flex items-center justify-between gap-3 py-3 font-bold">
        <span>Total</span>
        <span>{total} posts a week</span>
      </div>
    </div>
  );
}
