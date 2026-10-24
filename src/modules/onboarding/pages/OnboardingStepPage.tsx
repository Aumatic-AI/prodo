"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { stepIndex, type StepKey } from "@/core/onboarding/steps";
import { useOnboarding } from "../store/OnboardingStoreProvider";
import { BasicsStep } from "../steps/basics/BasicsStep";
import { ProductsStep } from "../steps/products/ProductsStep";
import { ServicesStep } from "../steps/services/ServicesStep";
import { StyleStep } from "../steps/style/StyleStep";
import { ConnectStep } from "../steps/connect/ConnectStep";
import { ReviewStep } from "../steps/review/ReviewStep";
import { ProgressStep } from "../steps/progress/ProgressStep";
import { BibleStep } from "../steps/bible/BibleStep";

/** The wizard steps, the research progress screen after submit, and the Brand Bible review after research. */
export type StepRoute = StepKey | "progress" | "bible";

/** Where the client should be instead, or null when this page is allowed. */
function redirectFor(route: StepRoute, furthest: StepKey, status: string): string | null {
  // Researching: only the progress screen. Research done: progress or the Bible review.
  if (status === "analyzing") return route === "progress" ? null : "/onboarding/progress";
  if (status === "review") return route === "progress" || route === "bible" ? null : "/onboarding/bible";
  if (route === "progress" || route === "bible") return `/onboarding/${furthest}`;
  return stepIndex(route) > stepIndex(furthest) ? `/onboarding/${furthest}` : null;
}

export function OnboardingStepPage({ step }: { step: StepRoute }) {
  const router = useRouter();
  const furthest = useOnboarding((s) => s.draft.step);
  const status = useOnboarding((s) => s.draft.status);
  const isService = useOnboarding((s) => s.draft.basics.businessType === "service");
  const target = redirectFor(step, furthest, status);

  useEffect(() => {
    if (target) router.replace(target);
  }, [target, router]);

  if (target) return null;

  switch (step) {
    case "basics":
      return <BasicsStep />;
    case "business":
      return isService ? <ServicesStep /> : <ProductsStep />;
    case "style":
      return <StyleStep />;
    case "connect":
      return <ConnectStep />;
    case "review":
      return <ReviewStep />;
    case "progress":
      return <ProgressStep />;
    case "bible":
      return <BibleStep />;
  }
}
