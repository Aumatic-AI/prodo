"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { useSession } from "@/stores/SessionStoreProvider";
import { useOnboarding } from "../store/OnboardingStoreProvider";

/** Submits the wizard and moves to the research screen. */
export function useSubmit() {
  const router = useRouter();
  const setStatus = useOnboarding((s) => s.setStatus);
  const updateBusiness = useSession((s) => s.updateBusiness);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      await apiFetch("/api/onboarding/submit", { method: "POST" });
      setStatus("analyzing");
      updateBusiness({ onboardingStatus: "analyzing" });
      router.replace("/onboarding/progress");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't submit. Try again.");
      setSubmitting(false);
    }
  }

  return { submit, submitting, error };
}
