"use client";

import { useShallow } from "zustand/react/shallow";
import type { StepKey } from "@/core/onboarding/steps";
import { PRODUCTS_META, SERVICES_META, STEP_META } from "../config";
import { useOnboarding } from "../store/OnboardingStoreProvider";

/** Steps of this business whose answers differ from what's saved (the other business type's step is ignored). */
export function useUnsavedSteps(): { step: StepKey; label: string }[] {
  return useOnboarding(
    useShallow((s) => {
      const isService = s.draft.basics.businessType === "service";
      const steps: { step: StepKey; label: string; dirty?: boolean }[] = [
        { step: "basics", label: STEP_META.basics.nav, dirty: s.dirty.basics },
        { step: "business", label: isService ? SERVICES_META.nav : PRODUCTS_META.nav, dirty: isService ? s.dirty.services : s.dirty.products },
        { step: "style", label: STEP_META.style.nav, dirty: s.dirty.style },
      ];
      return steps.filter((x) => x.dirty).map(({ step, label }) => ({ step, label }));
    })
  );
}
