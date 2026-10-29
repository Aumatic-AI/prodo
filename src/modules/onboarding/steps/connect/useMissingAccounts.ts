"use client";

import { POSTING_PLATFORMS, type PostingPlatform } from "@/core/onboarding/options";
import { useAccounts } from "@/modules/accounts/hooks/useAccounts";
import { useOnboarding } from "../../store/OnboardingStoreProvider";

/** Platforms with posts planned but no connected account. Uses the cached account list. */
export function useMissingAccounts(): PostingPlatform[] {
  const { data: accounts } = useAccounts();
  const posting = useOnboarding((s) => s.draft.content.postsPerWeek);
  if (!accounts) return [];
  const connected = new Set(accounts.map((a) => a.platform));
  return POSTING_PLATFORMS.filter((p) => (posting[p] ?? 0) > 0 && !connected.has(p));
}
