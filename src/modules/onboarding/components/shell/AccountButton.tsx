"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, Loader2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import { useSession } from "@/stores/SessionStoreProvider";
import { floating, focusRing } from "@/components/kit/styles";

/** Who is logged in, with Log out: onboarding has no sidebar, so this is the way to switch accounts. */
export function AccountButton() {
  const email = useSession((s) => s.user.email);
  const businessName = useSession((s) => s.business.name);
  const [leaving, setLeaving] = useState(false);
  const initial = (businessName || email || "P").trim().charAt(0).toUpperCase();

  async function logout() {
    setLeaving(true);
    await createClient().auth.signOut();
    // Full reload: the next login on this browser starts with nothing cached from this one
    window.location.assign("/login");
  }

  return (
    <Popover.Root>
      <Popover.Trigger
        aria-label="Account"
        className={cn(
          "flex items-center gap-2 rounded-ob-md p-1 pr-2 text-left transition-colors hover:bg-ob-sunken data-[popup-open]:bg-ob-sunken",
          focusRing
        )}
      >
        <span className="grid size-8 place-items-center rounded-ob border border-ob-line bg-ob-sunken text-[13px] font-bold text-ob-ink-soft">{initial}</span>
        <ChevronDown size={14} className="text-ob-faint" aria-hidden="true" />
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Positioner side="bottom" align="end" sideOffset={8} collisionPadding={12} className="z-50 outline-none">
          <Popover.Popup className={cn(floating, "flex w-[260px] flex-col gap-1 p-1.5")}>
            <div className="flex min-w-0 flex-col px-2.5 py-2">
              <span className="truncate text-sm font-bold">{businessName || "Your business"}</span>
              <span className="truncate text-xs text-ob-muted">{email}</span>
            </div>
            <div className="mx-1 border-t border-ob-line" />
            <button
              type="button"
              onClick={logout}
              disabled={leaving}
              className={cn(
                "flex w-full items-center gap-2.5 rounded-ob px-3 py-2 text-left text-sm font-semibold text-ob-muted transition-colors hover:bg-ob-danger-soft hover:text-ob-danger disabled:opacity-60",
                focusRing
              )}
            >
              {leaving ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />} Log out
            </button>
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  );
}
