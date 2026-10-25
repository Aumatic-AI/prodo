"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Dialog } from "@base-ui/react/dialog";
import { Bell, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { button, focusRing } from "@/components/kit/styles";
import { Logo } from "@/components/kit/Logo";
import { useNotifications } from "@/modules/notifications/hooks/useNotifications";
import { AccountMenu, BottomLinks, NavGroups } from "./NavContent";

/** Phones and tablets (below lg): a sticky top bar with the menu, the logo and Notifications. The menu opens the navigation as a drawer. */
export function MobileTopBar() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const { data } = useNotifications();
  const unread = data?.unread ?? 0;

  // Close after moving to another page
  useEffect(() => setOpen(false), [pathname]);
  const close = () => setOpen(false);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ob-line bg-ob-surface/95 px-3 backdrop-blur-sm lg:hidden">
        <button type="button" className={button({ variant: "quiet", size: "icon" })} aria-label="Open menu" onClick={() => setOpen(true)}>
          <Menu size={20} />
        </button>
        <Link href="/week" aria-label="Prodo home" className={cn("rounded-ob", focusRing)}>
          <Logo size="sm" />
        </Link>
        <Link href="/notifications" aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"} className={cn(button({ variant: "quiet", size: "icon" }), "relative")}>
          <Bell size={19} />
          {unread > 0 && <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-ob-danger ring-2 ring-ob-surface" />}
        </Link>
      </header>

      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-40 bg-ob-dark/45 backdrop-blur-[2px] transition-opacity duration-200 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0 lg:hidden" />
          <Dialog.Popup
            className={cn(
              "fixed bottom-0 left-0 top-0 z-50 flex w-[min(300px,86vw)] flex-col bg-ob-surface font-ob text-ob-ink shadow-ob-md outline-none lg:hidden",
              "transition-transform duration-200 ease-out data-[ending-style]:-translate-x-full data-[starting-style]:-translate-x-full"
            )}
          >
            <div className="flex h-14 items-center justify-between border-b border-ob-line px-4">
              <Dialog.Title className="m-0">
                <Logo size="sm" />
              </Dialog.Title>
              <Dialog.Close className={button({ variant: "quiet", size: "icon" })} aria-label="Close menu">
                <X size={18} />
              </Dialog.Close>
            </div>
            <NavGroups onNavigate={close} />
            <BottomLinks onNavigate={close} />
            <AccountMenu onNavigate={close} />
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}
