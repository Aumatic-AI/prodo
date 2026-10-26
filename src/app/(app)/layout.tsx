import { redirect } from "next/navigation";
import { MobileTopBar } from "@/components/layout/MobileTopBar";
import { Sidebar } from "@/components/layout/Sidebar";
import { SplashScreen } from "@/components/layout/SplashScreen";
import { NO_BUSINESS_SIGN_OUT, getSession } from "@/core/session";
import { SessionStoreProvider } from "@/stores/SessionStoreProvider";

// Checked once per page load (layouts stay mounted while moving between tabs)
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  // A login without a business can't use the app: sign it out with a plain message
  if (!session.business) redirect(NO_BUSINESS_SIGN_OUT);
  if (session.business.onboardingStatus !== "done") redirect("/onboarding");

  return (
    <SessionStoreProvider session={{ ...session, business: session.business }}>
      {/* Same look as onboarding: ob-* colours and the Plus Jakarta font */}
      {/* Covers the first load while the first screens' data is fetched */}
      <SplashScreen />
      <div className="min-h-screen bg-ob-bg font-ob text-[15px] text-ob-ink antialiased">
        <Sidebar />
        <main
          className="min-h-screen min-w-0"
          style={{ marginLeft: "var(--sidebar-current-width, 0px)", transition: "margin-left 200ms ease" }}
        >
          {/* Phones and tablets: top bar with the menu drawer (the sidebar is desktop only) */}
          <MobileTopBar />
          <div className="overflow-x-clip px-4 py-6 sm:px-8 sm:py-8 lg:px-10">{children}</div>
        </main>
      </div>
    </SessionStoreProvider>
  );
}
