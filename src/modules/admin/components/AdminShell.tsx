"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Popover } from "@base-ui/react/popover";
import { BarChart3, Building2, LayoutDashboard, LogOut, Monitor, Moon, ReceiptText, Sun, Tags, type LucideIcon } from "lucide-react";
import { Logo } from "@/components/kit/Logo";
import { floating, focusRing } from "@/components/kit/styles";
import { createClient } from "@/lib/supabase/browser";
import { useTheme, type ThemeChoice } from "@/lib/theme";
import { cn } from "@/lib/utils";

// The admin panel's frame: a top bar (logo, tabs, the admin's menu), no sidebar. Same ob-* look as the app.

const TABS: { label: string; href: string; icon: LucideIcon }[] = [
  { label: "Dashboard", href: "/admin", icon: LayoutDashboard },
  { label: "Businesses", href: "/admin/businesses", icon: Building2 },
  { label: "Usage", href: "/admin/usage", icon: BarChart3 },
  { label: "Top-ups", href: "/admin/topups", icon: ReceiptText },
  { label: "Prices", href: "/admin/prices", icon: Tags },
];

const THEMES: { value: ThemeChoice; label: string; icon: LucideIcon }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function Tabs({ className }: { className?: string }) {
  const pathname = usePathname();
  const active = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`));
  return (
    <nav className={cn("flex items-center gap-1", className)} aria-label="Admin">
      {TABS.map((t) => {
        const Icon = t.icon;
        const on = active(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-ob px-3 py-2 text-[14px] font-semibold transition-colors",
              focusRing,
              on ? "bg-ob-primary-soft text-ob-primary" : "text-ob-muted hover:bg-ob-sunken hover:text-ob-ink"
            )}
          >
            <Icon size={16} aria-hidden="true" />
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

function AdminMenu({ email }: { email: string }) {
  const { choice, setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const initial = (email || "A").charAt(0).toUpperCase();

  async function logout() {
    await createClient().auth.signOut();
    window.location.assign("/login");
  }

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger
        aria-label="Admin menu"
        className={cn("grid size-9 place-items-center rounded-full bg-ob-dark text-sm font-bold text-ob-on-dark ring-2 ring-ob-surface transition-transform hover:scale-105", focusRing)}
      >
        {initial}
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12} className="z-50 outline-none">
          <Popover.Popup className={cn(floating, "flex w-[248px] flex-col gap-1 p-1.5")}>
            <div className="flex flex-col px-2.5 py-2">
              <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-ob-faint">Admin</span>
              <span className="truncate text-sm font-bold">{email}</span>
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
            <button
              type="button"
              onClick={logout}
              className={cn("flex w-full items-center gap-2.5 rounded-ob px-3 py-2 text-left text-sm font-semibold text-ob-muted transition-colors hover:bg-ob-danger-soft hover:text-ob-danger", focusRing)}
            >
              <LogOut size={16} /> Log out
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-ob-bg font-ob text-[15px] text-ob-ink antialiased">
      <header className="sticky top-0 z-30 border-b border-ob-line bg-ob-surface/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-6 px-4 sm:px-8">
          <Link href="/admin" className={cn("flex shrink-0 items-center gap-2.5 rounded-ob", focusRing)}>
            <Logo size="sm" />
            <span className="rounded-full bg-ob-dark px-2 py-0.5 text-[11px] font-bold uppercase tracking-[0.06em] text-ob-on-dark">Admin</span>
          </Link>
          <Tabs className="hidden lg:flex" />
          <div className="ml-auto">
            <AdminMenu email={email} />
          </div>
        </div>
        <Tabs className="overflow-x-auto px-4 pb-2.5 sm:px-8 lg:hidden" />
      </header>
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-8 sm:py-8">{children}</main>
    </div>
  );
}
