import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSession } from "@/core/session";
import { getOnboardingDraft } from "@/modules/onboarding/server";
import { SessionStoreProvider } from "@/stores/SessionStoreProvider";
import { OnboardingStoreProvider } from "@/modules/onboarding/store/OnboardingStoreProvider";
import { OnboardingShell } from "@/modules/onboarding/components/shell/OnboardingShell";

export const metadata = { title: "Set up Prodo" };

// Loads everything once on the server. Moving between steps makes no extra requests.
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.business.onboardingStatus === "done") redirect("/week");

  const draft = await getOnboardingDraft();

  return (
    <div className="min-h-screen bg-ob-bg font-ob text-[15px] leading-normal text-ob-ink antialiased">
      <SessionStoreProvider session={session}>
        <OnboardingStoreProvider draft={draft}>
          <OnboardingShell>{children}</OnboardingShell>
        </OnboardingStoreProvider>
      </SessionStoreProvider>
    </div>
  );
}
