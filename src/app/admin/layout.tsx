import type { ReactNode } from "react";
import { requireAdmin } from "@/core/admin/guard";
import { AdminShell } from "@/modules/admin/components/AdminShell";

export const metadata = { title: { default: "Admin", template: "%s · Prodo admin" } };

// Admins only: anyone else gets the not-found page (the middleware and every admin API route check too)
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return <AdminShell email={admin.email}>{children}</AdminShell>;
}
