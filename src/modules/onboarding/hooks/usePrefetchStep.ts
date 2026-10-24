"use client";

import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { StepKey } from "@/core/onboarding/steps";
import { accountsQuery } from "@/modules/accounts/hooks/useAccounts";

/**
 * Starts loading the data a step needs before the client opens it.
 * Uses the shared cache: fresh data is not fetched again, and errors are ignored here
 * (the step shows them when it loads).
 */
export function usePrefetchStep() {
  const queryClient = useQueryClient();

  return useCallback(
    (step: StepKey | null) => {
      // Connect lists accounts; Review warns about planned platforms with no account
      if (step === "connect" || step === "review") void queryClient.prefetchQuery(accountsQuery);
    },
    [queryClient]
  );
}
