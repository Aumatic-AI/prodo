"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_ITEMS } from "@/config/navigation";
import { Zap, LogOut, ChevronsLeft, ChevronsRight } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";

interface SidebarProps {
  userEmail?: string;
}

const EXPANDED_WIDTH = 240;
const COLLAPSED_WIDTH = 68;

export function Sidebar({ userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      <aside
        className="fixed top-0 left-0 bottom-0 flex flex-col bg-sidebar z-30"
        style={{ width, transition: "width 200ms ease" }}
      >
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 h-[var(--navbar-height)] border-b border-white/[0.06]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary shrink-0">
            <Zap className="w-4 h-4 text-on-primary" fill="currentColor" />
          </div>
          {!collapsed && (
            <span className="text-base font-semibold text-sidebar-active tracking-tight whitespace-nowrap">Prodo</span>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1 px-3 pt-4">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={cn(
                  "flex items-center gap-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap overflow-hidden",
                  collapsed ? "justify-center px-0" : "px-3",
                  isActive
                    ? "bg-sidebar-active text-sidebar-text-active"
                    : "text-sidebar hover:bg-sidebar-hover hover:text-sidebar-text-active"
                )}
                style={isActive ? { backgroundColor: "var(--color-sidebar-active)", color: "var(--color-sidebar-text-active)" } : undefined}
              >
                <Icon className="w-[18px] h-[18px] shrink-0" />
                {!collapsed && item.label}
              </Link>
            );
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="px-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className={cn(
              "flex items-center gap-3 w-full py-2.5 rounded-lg text-sm font-medium text-sidebar hover:bg-sidebar-hover hover:text-sidebar-text-active transition-colors",
              collapsed ? "justify-center px-0" : "px-3"
            )}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronsRight className="w-[18px] h-[18px] shrink-0" />
            ) : (
              <ChevronsLeft className="w-[18px] h-[18px] shrink-0" />
            )}
            {!collapsed && "Collapse"}
          </button>
        </div>

        {/* User / Logout */}
        <div className="px-3 pb-4 border-t border-white/[0.06] pt-3 mt-1">
          {userEmail && !collapsed && (
            <p className="px-3 mb-2 text-xs text-sidebar truncate" title={userEmail}>
              {userEmail}
            </p>
          )}
          <button
            onClick={handleLogout}
            title={collapsed ? "Logout" : undefined}
            className={cn(
              "flex items-center gap-3 w-full py-2.5 rounded-lg text-sm font-medium text-sidebar hover:bg-sidebar-hover hover:text-sidebar-text-active transition-colors",
              collapsed ? "justify-center px-0" : "px-3"
            )}
          >
            <LogOut className="w-[18px] h-[18px] shrink-0" />
            {!collapsed && "Logout"}
          </button>
        </div>
      </aside>

      {/* Main content offset */}
      <style>{`
        :root { --sidebar-current-width: ${width}px; }
      `}</style>
    </>
  );
}
