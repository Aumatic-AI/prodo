"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { StepKey } from "@/core/onboarding/steps";
import { PRODUCTS_META, SERVICES_META, STEP_META } from "../config";
import { useOnboarding } from "../store/OnboardingStoreProvider";

/** Steps of this business whose answers differ from what's saved (the other business type's step is ignored). */
export function useUnsavedSteps(): { step: StepKey; label: string }[] {
  // Only plain values come out of the store (a new list each time would re-render forever)
  const { isService, content, basics, products, services } = useOnboarding(
    useShallow((s) => ({
      isService: s.draft.basics.businessType === "service",
      content: s.dirty.content,
      basics: s.dirty.basics,
      products: s.dirty.products,
      services: s.dirty.services,
    }))
  );

  return useMemo(() => {
    const steps: { step: StepKey; label: string; dirty?: boolean }[] = [
      { step: "content", label: STEP_META.content.nav, dirty: content },
      { step: "basics", label: STEP_META.basics.nav, dirty: basics },
      { step: "business", label: isService ? SERVICES_META.nav : PRODUCTS_META.nav, dirty: isService ? services : products },
    ];
    return steps.filter((x) => x.dirty).map(({ step, label }) => ({ step, label }));
  }, [isService, content, basics, products, services]);
}
