"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { Bell, ChevronDown, ChevronsUpDown, LogOut, Monitor, Moon, Settings, Sun, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_GROUPS, SETTINGS_ITEM, type NavGroup, type NavItem } from "@/config/navigation";
import { createClient } from "@/lib/supabase/browser";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { useSession } from "@/stores/SessionStoreProvider";
import { floating, focusRing } from "@/components/kit/styles";
import { publicUrl } from "@/components/kit/MediaUploader";
import { useNotifications } from "@/modules/notifications/hooks/useNotifications";

// The navigation shared by the desktop sidebar and the mobile drawer.

export function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function NavLink({
  item,
  active,
  collapsed = false,
  onNavigate,
  badge,
}: {
  item: NavItem;
  active: boolean;
  collapsed?: boolean;
  onNavigate?: () => void;
  /** A count shown on the right (or as a dot when collapsed) */
  badge?: number;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-ob py-2.5 text-[14.5px] font-semibold transition-colors",
        focusRing,
        collapsed ? "justify-center px-0" : "px-3",
        active ? "bg-ob-primary-soft text-ob-primary" : "text-ob-muted hover:bg-ob-sunken hover:text-ob-ink"
      )}
    >
      <Icon size={19} className="shrink-0" aria-hidden="true" />
      {!collapsed && <span className="flex-1 truncate">{item.label}</span>}
      {!!badge &&
        (collapsed ? (
          <span className="absolute right-3 top-2 size-2 rounded-full bg-ob-danger ring-2 ring-ob-surface" aria-label={`${badge} unread`} />
        ) : (
          <span className="grid h-5 min-w-5 place-items-center rounded-full bg-ob-danger px-1.5 text-[11px] font-bold leading-none text-ob-on-primary">{badge > 99 ? "99+" : badge}</span>
        ))}
    </Link>
  );
}

/** A group shown as one row that opens to its links. Open by itself on one of its pages; otherwise remembered per browser. */
function CollapsibleGroup({ group, collapsed, onNavigate }: { group: NavGroup; collapsed: boolean; onNavigate?: () => void }) {
  const isActive = useIsActive();
  const key = `prodo.nav.${group.label}`;
  const hasActive = group.items.some((i) => isActive(i.href));
  const [open, setOpen] = useState(false);

  useEffect(() => {
    try {
      setOpen(localStorage.getItem(key) === "1");
    } catch {
      // storage unavailable
    }
  }, [key]);

  function toggle() {
    setOpen((o) => {
      try {
        localStorage.setItem(key, o ? "0" : "1");
      } catch {
        // storage unavailable
      }
      return !o;
    });
  }

  const shown = open || hasActive;
  const Icon = group.collapsible!.icon;
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={shown}
        title={collapsed ? group.label : undefined}
        className={cn(
          "flex items-center gap-3 rounded-ob py-2.5 text-[14.5px] font-semibold transition-colors",
          focusRing,
          collapsed ? "justify-center px-0" : "px-3",
          hasActive && !shown ? "text-ob-primary" : "text-ob-muted hover:bg-ob-sunken hover:text-ob-ink"
        )}
      >
        <Icon size={19} className="shrink-0" aria-hidden="true" />
        {!collapsed && <span className="flex-1 truncate text-left">{group.label}</span>}
        {!collapsed && <ChevronDown size={16} className={cn("shrink-0 transition-transform duration-200", shown && "rotate-180")} aria-hidden="true" />}
      </button>
      {shown && (
        <div className={cn("flex flex-col gap-0.5", !collapsed && "ml-[21px] border-l border-ob-line pl-2")}>
          {group.items.map((item) => (
            <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} onNavigate={onNavigate} />
          ))}
        </div>
      )}
    </div>
  );
}

/** The grouped tab links. Collapsible groups (Insights) are one row that opens to their links. */
export function NavGroups({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const isActive = useIsActive();
  return (
    <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-5" aria-label="Main">
      {NAV_GROUPS.map((group) =>
        group.collapsible ? (
          <CollapsibleGroup key={group.label} group={group} collapsed={collapsed} onNavigate={onNavigate} />
        ) : (
          <div key={group.label} className="flex flex-col gap-1">
            {!collapsed && <span className="px-3 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ob-faint">{group.label}</span>}
            {group.items.map((item) => (
              <NavLink key={item.href} item={item} active={isActive(item.href)} collapsed={collapsed} onNavigate={onNavigate} />
            ))}
          </div>
        )
      )}
    </nav>
  );
}

export const NOTIFICATIONS_ITEM: NavItem = { label: "Notifications", href: "/notifications", icon: Bell };

/** Notifications and Settings, at the bottom of the navigation. */
export function BottomLinks({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const isActive = useIsActive();
  const { data } = useNotifications();
  return (
    <div className="flex flex-col gap-1 border-t border-ob-line px-3 py-3">
      <NavLink item={NOTIFICATIONS_ITEM} active={isActive(NOTIFICATIONS_ITEM.href)} collapsed={collapsed} onNavigate={onNavigate} badge={data?.unread} />
      <NavLink item={SETTINGS_ITEM} active={isActive(SETTINGS_ITEM.href)} collapsed={collapsed} onNavigate={onNavigate} />
    </div>
  );
}

const THEMES: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function Avatar() {
  const business = useSession((s) => s.business);
  const initial = (business.name || "P").trim().charAt(0).toUpperCase();
  return (
    <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-ob border border-ob-line bg-ob-sunken text-sm font-bold text-ob-ink-soft">
      {business.logoKey ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={publicUrl(business.logoKey)} alt="" className="size-full object-contain p-1" />
      ) : (
        initial
      )}
    </span>
  );
}

/** The business at the bottom: opens a small menu with the theme, Settings and Log out. */
export function AccountMenu({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const userEmail = useSession((s) => s.user.email);
  const business = useSession((s) => s.business);
  const { choice, setTheme } = useTheme();

  async function logout() {
    await createClient().auth.signOut();
    // Full reload: the next login on this browser starts with no cached data from this business
    window.location.assign("/login");
  }

  const item = "flex w-full items-center gap-2.5 rounded-ob px-3 py-2 text-left text-sm font-semibold transition-colors";

  return (
    <div className={cn("border-t border-ob-line p-2", collapsed && "flex justify-center")}>
      <Popover.Root>
        <Popover.Trigger
          title={collapsed ? (business.name || "Account") : undefined}
          className={cn(
            "flex w-full items-center gap-3 rounded-ob-md text-left transition-colors hover:bg-ob-sunken data-[popup-open]:bg-ob-sunken",
            focusRing,
            collapsed ? "w-auto p-1.5" : "p-2"
          )}
        >
          <Avatar />
          {!collapsed && (
            <>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-bold">{business.name || "Your business"}</span>
                <span className="truncate text-xs text-ob-muted">{userEmail}</span>
              </span>
              <ChevronsUpDown size={15} className="shrink-0 text-ob-faint" />
            </>
          )}
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner side={collapsed ? "right" : "top"} align={collapsed ? "end" : "start"} sideOffset={8} collisionPadding={12} className="z-50 outline-none">
            <Popover.Popup className={cn(floating, "flex w-[264px] flex-col gap-1 p-1.5")}>
              <div className="flex items-center gap-3 px-2.5 py-2">
                <Avatar />
                <span className="flex min-w-0 flex-col">
                  <span className="truncate text-sm font-bold">{business.name || "Your business"}</span>
                  <span className="truncate text-xs text-ob-muted">{userEmail}</span>
                </span>
              </div>

              <div className="mx-1 border-t border-ob-line" />

              <div className="flex flex-col gap-1.5 px-2.5 py-2">
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ob-faint">Appearance</span>
                <div className="grid grid-cols-3 gap-1 rounded-ob bg-ob-sunken p-1" role="radiogroup" aria-label="Theme">
                  {THEMES.map((t) => {
                    const Icon = t.icon;
                    const on = choice === t.value;
                    return (
                      <button
                        key={t.value}
                        type="button"
                        role="radio"
                        aria-checked={on}
                        onClick={() => setTheme(t.value)}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-[7px] py-1.5 text-[11.5px] font-semibold transition-colors",
                          on ? "bg-ob-surface text-ob-ink shadow-ob-xs" : "text-ob-muted hover:text-ob-ink",
                          focusRing
                        )}
                      >
                        <Icon size={15} />
                        {t.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mx-1 border-t border-ob-line" />

              <Link href="/settings" onClick={onNavigate} className={cn(item, "text-ob-ink hover:bg-ob-sunken", focusRing)}>
                <Settings size={16} className="text-ob-muted" /> Settings
              </Link>
              <button type="button" onClick={logout} className={cn(item, "text-ob-muted hover:bg-ob-danger-soft hover:text-ob-danger", focusRing)}>
                <LogOut size={16} /> Log out
              </button>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
