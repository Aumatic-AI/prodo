"use client";

import { useState } from "react";
import { Popover } from "@base-ui/react/popover";
import { ChevronDown, Loader2, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/browser";
import { useSession } from "@/stores/SessionStoreProvider";
import { floating, focusRing } from "@/components/kit/styles";
import type { AccountView } from "@/core/accounts";
import { AccountsSection } from "@/components/layout/accounts/AccountsSection";
import { AddAccountModal, RemoveAccountDialog } from "@/components/layout/accounts/AccountDialogs";

/**
 * Who is logged in, the login's other accounts and Log out: onboarding has no sidebar, so this is where to switch
 * away from a setup (it stays as "Setting up" to finish later) or remove it.
 */
export function AccountButton() {
  const email = useSession((s) => s.user.email);
  const businessName = useSession((s) => s.business.name);
  // The open business's own login email; after switching it differs from the login being used
  const businessEmail = useSession((s) => s.business.loginEmail) || email;
  const [leaving, setLeaving] = useState(false);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [removing, setRemoving] = useState<AccountView | null>(null);
  const initial = (businessName || email || "P").trim().charAt(0).toUpperCase();

  async function logout() {
    setLeaving(true);
    await createClient().auth.signOut();
    // Full reload: the next login on this browser starts with nothing cached from this one
    window.location.assign("/login");
  }

  return (
    <>
      <Popover.Root open={open} onOpenChange={setOpen}>
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
            <Popover.Popup className={cn(floating, "flex w-[280px] flex-col gap-1 p-1.5")}>
              <div className="flex min-w-0 flex-col px-2.5 py-2">
                <span className="truncate text-sm font-bold">{businessName || "Your business"}</span>
                <span className="truncate text-xs text-ob-muted">{businessEmail}</span>
                {businessEmail !== email && <span className="truncate text-[11px] text-ob-faint">Logged in as {email}</span>}
              </div>
              <div className="mx-1 border-t border-ob-line" />
              <AccountsSection
                onAdd={() => {
                  setOpen(false);
                  setAdding(true);
                }}
                onRemove={(account) => {
                  setOpen(false);
                  setRemoving(account);
                }}
              />
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
      <AddAccountModal open={adding} onOpenChange={setAdding} />
      <RemoveAccountDialog account={removing} onClose={() => setRemoving(null)} />
    </>
  );
}
