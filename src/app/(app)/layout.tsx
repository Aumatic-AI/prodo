import { Sidebar } from "@/components/layout/Sidebar";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen bg-page">
      <Sidebar userEmail={user?.email} />
      <main
        className="min-h-screen"
        style={{ marginLeft: "var(--sidebar-current-width, var(--sidebar-width))", transition: "margin-left 200ms ease" }}
      >
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
}
