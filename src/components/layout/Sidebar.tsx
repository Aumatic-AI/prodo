"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/kit/styles";
import { Logo, LogoMark } from "@/components/kit/Logo";
import { AccountMenu, BottomLinks, NavGroups } from "./NavContent";

const EXPANDED_WIDTH = 248;
const COLLAPSED_WIDTH = 72;
const STORAGE_KEY = "prodo.sidebar.collapsed";

/**
 * Desktop sidebar (lg and up): grouped navigation, Notifications and Settings, the account menu
 * at the bottom. Collapsed with the round button on its edge (remembered per browser). Below lg
 * the MobileTopBar and its drawer take over.
 */
export function Sidebar() {
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

  const width = collapsed ? COLLAPSED_WIDTH : EXPANDED_WIDTH;

  return (
    <>
      <aside
        className="group/sidebar fixed bottom-0 left-0 top-0 z-30 hidden flex-col border-r border-ob-line bg-ob-surface font-ob text-ob-ink lg:flex"
        style={{ width, transition: "width 200ms ease" }}
      >
        <div className={cn("flex h-16 shrink-0 items-center gap-2.5 border-b border-ob-line", collapsed ? "justify-center px-0" : "px-5")}>
          <Link href="/week" aria-label="Prodo home" className={cn("rounded-ob", focusRing)}>
            {collapsed ? <LogoMark size={30} /> : <Logo />}
          </Link>
        </div>

        {/* Round toggle on the sidebar's edge, apart from the tabs */}
        <button
          type="button"
          onClick={toggle}
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className={cn(
            "absolute -right-3 top-[52px] z-10 grid size-6 place-items-center rounded-full border border-ob-line bg-ob-surface text-ob-muted shadow-ob-sm transition-[opacity,color,transform] duration-150",
            "opacity-0 hover:scale-110 hover:text-ob-ink focus-visible:opacity-100 group-hover/sidebar:opacity-100",
            collapsed && "opacity-100",
            focusRing
          )}
        >
          {collapsed ? <ChevronRight size={13} /> : <ChevronLeft size={13} />}
        </button>

        <NavGroups collapsed={collapsed} />
        <BottomLinks collapsed={collapsed} />
        <AccountMenu collapsed={collapsed} />
      </aside>

      {/* Main content follows the sidebar width on desktop; no offset on phones and tablets */}
      <style>{`:root { --sidebar-current-width: 0px; } @media (min-width: 1024px) { :root { --sidebar-current-width: ${width}px; } }`}</style>
    </>
  );
}
