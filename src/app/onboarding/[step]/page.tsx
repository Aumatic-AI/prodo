import { notFound, redirect } from "next/navigation";
import { isStep } from "@/core/onboarding/steps";
import { OnboardingStepPage } from "@/modules/onboarding/pages/OnboardingStepPage";

export default async function OnboardingStep({ params }: { params: Promise<{ step: string }> }) {
  const { step } = await params;
  // Old address of the screen shown after submit
  if (step === "submitted") redirect("/onboarding/progress");
  if (!isStep(step) && step !== "progress" && step !== "bible") notFound();
  return <OnboardingStepPage step={step} />;
}
