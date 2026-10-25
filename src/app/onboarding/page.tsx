import { redirect } from "next/navigation";
import { getOnboardingDraft } from "@/modules/onboarding/server";

// Resume where the client left off
export default async function OnboardingIndex() {
  const draft = await getOnboardingDraft();
  if (draft.status === "analyzing") redirect("/onboarding/progress");
  if (draft.status === "review") redirect("/onboarding/bible");
  redirect(`/onboarding/${draft.step}`);
}
