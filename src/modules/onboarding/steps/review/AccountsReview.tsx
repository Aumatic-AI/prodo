"use client";

import { useAccounts } from "@/modules/accounts/hooks/useAccounts";
import { PlatformIcon } from "@/components/kit/PlatformIcon";
import { SOCIAL_LABELS } from "../../config";
import { ReviewCard } from "./ReviewCard";

export function AccountsReview() {
  const { data: accounts, isLoading, error } = useAccounts();

  return (
    <ReviewCard title="Connected accounts" step="connect">
      {isLoading ? (
        <div className="h-14 animate-pulse rounded-ob-md bg-ob-line" />
      ) : error ? (
        <p className="m-0 text-sm text-ob-muted">Accounts can&apos;t be loaded right now. You can check them on the Connect step.</p>
      ) : !accounts?.length ? (
        <p className="m-0 text-sm text-ob-faint">No accounts connected yet</p>
      ) : (
        <ul className="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(min(100%,240px),1fr))] gap-3 p-0">
          {accounts.map((account) => (
            <li key={account.id} className="flex items-center gap-3 rounded-ob-md border border-ob-line bg-ob-bg p-3">
              <PlatformIcon platform={account.platform} />
              <span className="flex min-w-0 flex-col">
                <span className="truncate text-sm font-bold">{account.name}</span>
                <span className="text-[13px] text-ob-muted">{SOCIAL_LABELS[account.platform] ?? account.platform}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </ReviewCard>
  );
}
