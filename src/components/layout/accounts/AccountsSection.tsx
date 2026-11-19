"use client";

import { useState } from "react";
import { Check, Loader2, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { focusRing } from "@/components/kit/styles";
import { Badge } from "@/components/kit/Badge";
import { Skeleton } from "@/components/kit/Skeleton";
import { publicUrl } from "@/components/kit/MediaUploader";
import type { AccountView } from "@/core/accounts";
import { openBusiness, useAccounts } from "./useAccounts";

/**
 * The login's businesses in the account menu: set-up ones to switch to, ones still setting up (continue or remove),
 * and "Add account". Switching reloads this tab into the other business.
 */
export function AccountsSection({ onAdd, onRemove }: { onAdd: () => void; onRemove: (account: AccountView) => void }) {
  const { data: accounts, isLoading, error } = useAccounts(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  async function open(account: AccountView) {
    if (account.current || opening) return;
    setOpening(account.id);
    setProblem(null);
    try {
      await openBusiness(account.id);
    } catch (e) {
      setOpening(null);
      setProblem(e instanceof Error ? e.message : "Couldn't switch. Try again.");
    }
  }

  const ready = (accounts ?? []).filter((a) => a.status === "ready");
  const settingUp = (accounts ?? []).filter((a) => a.status === "setting_up");
  // A business can come off the list when another stays: a linked one, or one this login is still setting up
  const removable = (a: AccountView) => (accounts ?? []).length > 1 && (a.role === "member" || a.status === "setting_up");

  return (
    <div className="flex flex-col gap-0.5 py-1">
      <span className="px-2.5 pb-1 pt-1 text-[11px] font-bold uppercase tracking-[0.08em] text-ob-faint">Accounts</span>
      {isLoading && (
        <div className="flex flex-col gap-1.5 px-2.5 py-1">
          <Skeleton className="h-8" />
          <Skeleton className="h-8" />
        </div>
      )}
      {error && <p className="m-0 px-2.5 text-xs text-ob-danger">{error.message}</p>}
      <div className="flex max-h-[264px] flex-col gap-0.5 overflow-y-auto">
        {ready.map((a) => (
          <Row key={a.id} account={a} busy={opening === a.id} onOpen={() => open(a)} onRemove={removable(a) ? () => onRemove(a) : undefined} />
        ))}
        {settingUp.map((a) => (
          <Row key={a.id} account={a} busy={opening === a.id} onOpen={() => open(a)} onRemove={removable(a) ? () => onRemove(a) : undefined} badge="Setting up" />
        ))}
      </div>
      {problem && <p className="m-0 px-2.5 text-xs text-ob-danger">{problem}</p>}
      <button
        type="button"
        onClick={onAdd}
        className={cn("flex w-full items-center gap-2.5 rounded-ob px-2.5 py-2 text-left text-sm font-semibold text-ob-primary transition-colors hover:bg-ob-primary-soft", focusRing)}
      >
        <span className="grid size-7 place-items-center rounded-ob border border-dashed border-ob-line-strong">
          <Plus size={15} />
        </span>
        Add account
      </button>
    </div>
  );
}

function Row({ account, busy, onOpen, onRemove, badge }: { account: AccountView; busy: boolean; onOpen: () => void; onRemove?: () => void; badge?: string }) {
  const name = account.name || "New business";
  return (
    <div className={cn("group flex items-center gap-1 rounded-ob transition-colors", account.current ? "bg-ob-primary-soft" : "hover:bg-ob-sunken")}>
      <button
        type="button"
        onClick={onOpen}
        aria-current={account.current ? "true" : undefined}
        className={cn("flex min-w-0 flex-1 items-center gap-2.5 rounded-ob px-2.5 py-1.5 text-left", focusRing)}
      >
        <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-ob border border-ob-line bg-ob-surface text-xs font-bold text-ob-ink-soft">
          {account.logoKey ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={publicUrl(account.logoKey)} alt="" className="size-full object-contain p-0.5" />
          ) : (
            name.trim().charAt(0).toUpperCase()
          )}
        </span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-sm font-semibold text-ob-ink">{name}</span>
          {badge && (
            <Badge tone="warn" size="sm" className="self-start">
              {badge}
            </Badge>
          )}
        </span>
        {busy ? <Loader2 size={15} className="shrink-0 animate-spin text-ob-muted" /> : account.current && <Check size={15} className="shrink-0 text-ob-primary" />}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Remove ${name} from your accounts`}
          title="Remove from your accounts"
          className={cn("mr-1 grid size-7 shrink-0 place-items-center rounded-ob text-ob-faint opacity-0 transition-opacity hover:bg-ob-danger-soft hover:text-ob-danger focus-visible:opacity-100 group-hover:opacity-100", focusRing)}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
