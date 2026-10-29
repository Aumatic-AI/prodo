"use client";

import { useEffect } from "react";
import { apiFetch } from "@/lib/api-client";
import { scanRunning } from "@/core/onboarding/scan";
import type { OnboardingDraft } from "@/core/onboarding/schemas";
import { useOnboarding, useOnboardingApi } from "../store/OnboardingStoreProvider";

const POLL_MS = 4000;

/**
 * While the website scan runs, checks on it every few seconds. When it finishes, its findings
 * (Basics, products or services) replace the draft's untouched steps; edited steps keep the edits.
 */
export function useWebsiteScan() {
  const store = useOnboardingApi();
  const running = useOnboarding((s) => scanRunning(s.draft.scan));

  useEffect(() => {
    if (!running) return;
    let stopped = false;
    const timer = setInterval(async () => {
      try {
        const fresh = await apiFetch<OnboardingDraft>("/api/onboarding");
        if (!stopped && !scanRunning(fresh.scan)) store.getState().refresh(fresh);
      } catch {
        // A missed check is retried on the next tick
      }
    }, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [running, store]);
}
