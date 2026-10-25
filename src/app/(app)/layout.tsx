import { redirect } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { getSession } from "@/core/session";
import { SessionStoreProvider } from "@/stores/SessionStoreProvider";

// Checked once per page load (layouts stay mounted while moving between tabs)
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.business.onboardingStatus !== "done") redirect("/onboarding");

  return (
    <SessionStoreProvider session={session}>
      {/* Same look as onboarding: ob-* colours and the Plus Jakarta font */}
      <div className="min-h-screen bg-ob-bg font-ob text-[15px] text-ob-ink antialiased">
        <Sidebar />
        <main
          className="min-h-screen"
          style={{ marginLeft: "var(--sidebar-current-width, var(--sidebar-width))", transition: "margin-left 200ms ease" }}
        >
          <div className="px-5 py-8 sm:px-8 lg:px-10">{children}</div>
        </main>
      </div>
    </SessionStoreProvider>
  );
}
