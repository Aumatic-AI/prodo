"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ChevronsLeft, ChevronsRight, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, SETTINGS_ITEM, type NavItem } from "@/config/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useSession } from "@/stores/SessionStoreProvider";
import { focusRing } from "@/components/kit/styles";
import { publicUrl } from "@/components/kit/MediaUploader";

const EXPANDED_WIDTH = 248;
const COLLAPSED_WIDTH = 72;
const STORAGE_KEY = "prodo.sidebar.collapsed";

function NavLink({ item, active, collapsed }: { item: NavItem; active: boolean; collapsed: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-ob py-2.5 text-[14.5px] font-semibold transition-colors",
        focusRing,
        collapsed ? "justify-center px-0" : "px-3",
        active ? "bg-ob-primary-soft text-ob-primary" : "text-ob-muted hover:bg-ob-sunken hover:text-ob-ink"
      )}
    >
      <Icon size={19} className="shrink-0" aria-hidden="true" />
      {!collapsed && <span className="truncate">{item.label}</span>}
    </Link>
  );
}

/** App sidebar: grouped navigation, the business at the bottom, collapsible (remembered per browser). */
export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const userEmail = useSession((s) => s.user.email);
  const business = useSession((s) => s.business);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // storage unavailable
    }
  }, []);

  function toggle() {
    setCollapsed((c) => {
      try {
        localStorage.setItem(STORAGE_KEY, c ? "0" : "1");
      } catch {
        // storage unavailable
      }
      return !c;
    });
  }

  async function logout() {
    await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);
  const initial = (business.name || "P").trim().charAt(0).toUpperCase();

  return (
    <>
      <aside
        className="fixed bottom-0 left-0 top-0 z-30 flex flex-col border-r border-ob-line bg-ob-surface font-ob text-ob-ink"
        style={{ width, transition: "width 200ms ease" }}
      >
        <div className={cn("flex h-16 items-center gap-2.5 border-b border-ob-line", collapsed ? "justify-center px-0" : "px-5")}>
          <span className="grid size-[30px] shrink-0 place-items-center rounded-ob bg-ob-dark text-[15px] font-extrabold text-ob-on-dark" aria-hidden="true">
            P
          </span>
          {!collapsed && <span className="text-lg font-extrabold tracking-tight">Prodo</span>}
        </div>

        <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-5" aria-label="Main">
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="flex flex-col gap-1">
              {!collapsed && <span className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ob-faint">{group.label}</span>}
              {group.items.map((item) => (
                <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} />
              ))}
            </div>
          ))}
        </nav>

        <div className="flex flex-col gap-1 border-t border-ob-line px-3 py-3">
          <NavLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.href)} collapsed={collapsed} />
          <button
            type="button"
            onClick={toggle}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex items-center gap-3 rounded-ob py-2.5 text-[14.5px] font-semibold text-ob-muted transition-colors hover:bg-ob-sunken hover:text-ob-ink",
              focusRing,
              collapsed ? "justify-center px-0" : "px-3"
            )}
          >
            {collapsed ? <ChevronsRight size={19} /> : <ChevronsLeft size={19} />}
            {!collapsed && "Collapse"}
          </button>
        </div>

        <div className={cn("flex items-center gap-3 border-t border-ob-line py-3.5", collapsed ? "flex-col px-0" : "px-4")}>
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-ob border border-ob-line bg-ob-sunken text-sm font-bold text-ob-ink-soft">
            {business.logoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={publicUrl(business.logoKey)} alt="" className="size-full object-contain p-1" />
            ) : (
              initial
            )}
          </span>
          {!collapsed && (
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-bold">{business.name || "Your business"}</span>
              <span className="truncate text-xs text-ob-muted" title={userEmail ?? undefined}>
                {userEmail}
              </span>
            </span>
          )}
          <button
            type="button"
            onClick={logout}
            aria-label="Log out"
            title="Log out"
            className={cn("grid size-8 shrink-0 place-items-center rounded-ob text-ob-muted transition-colors hover:bg-ob-danger-soft hover:text-ob-danger", focusRing)}
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* Main content follows the sidebar width */}
      <style>{`:root { --sidebar-current-width: ${width}px; }`}</style>
    </>
  );
}
