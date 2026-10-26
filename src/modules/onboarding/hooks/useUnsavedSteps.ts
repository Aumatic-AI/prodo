"use client";

import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import type { StepKey } from "@/core/onboarding/steps";
import { PRODUCTS_META, SERVICES_META, STEP_META } from "../config";
import { useOnboarding } from "../store/OnboardingStoreProvider";

/** Steps of this business whose answers differ from what's saved (the other business type's step is ignored). */
export function useUnsavedSteps(): { step: StepKey; label: string }[] {
  // Only plain values come out of the store (a new list each time would re-render forever)
  const { isService, basics, products, services, style } = useOnboarding(
    useShallow((s) => ({
      isService: s.draft.basics.businessType === "service",
      basics: s.dirty.basics,
      products: s.dirty.products,
      services: s.dirty.services,
      style: s.dirty.style,
    }))
  );

  return useMemo(() => {
    const steps: { step: StepKey; label: string; dirty?: boolean }[] = [
      { step: "basics", label: STEP_META.basics.nav, dirty: basics },
      { step: "business", label: isService ? SERVICES_META.nav : PRODUCTS_META.nav, dirty: isService ? services : products },
      { step: "style", label: STEP_META.style.nav, dirty: style },
    ];
    return steps.filter((x) => x.dirty).map(({ step, label }) => ({ step, label }));
  }, [isService, basics, products, services, style]);
}
