import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { NO_BUSINESS_SIGN_OUT, getSession } from "@/core/session";
import { getOnboardingDraft } from "@/modules/onboarding/server";
import { SessionStoreProvider } from "@/stores/SessionStoreProvider";
import { OnboardingStoreProvider } from "@/modules/onboarding/store/OnboardingStoreProvider";
import { OnboardingShell } from "@/modules/onboarding/components/shell/OnboardingShell";

export const metadata = { title: "Set up Prodo" };

// Loads everything once on the server. Moving between steps makes no extra requests.
export default async function OnboardingLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // A login without a business can't use the app: sign it out with a plain message
  if (!session.business) redirect(NO_BUSINESS_SIGN_OUT);
  if (session.business.onboardingStatus === "done") redirect("/week");

  const draft = await getOnboardingDraft();

  return (
    <div className="min-h-screen bg-ob-bg font-ob text-[15px] leading-normal text-ob-ink antialiased">
      <SessionStoreProvider session={{ ...session, business: session.business }}>
        <OnboardingStoreProvider draft={draft}>
          <OnboardingShell>{children}</OnboardingShell>
        </OnboardingStoreProvider>
      </SessionStoreProvider>
    </div>
  );
}
