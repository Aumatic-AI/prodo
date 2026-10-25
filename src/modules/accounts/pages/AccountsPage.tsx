"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { AccountCard } from "../components/AccountCard";
import { ConnectAccountButton } from "../components/ConnectAccountButton";
import { useAccounts } from "../hooks/useAccounts";
import { Users } from "lucide-react";

export function AccountsPage() {
  const { data: accounts, isLoading, error, refetch } = useAccounts();

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Accounts</h1>
          <p className="mt-1 text-sm text-muted">Your connected social accounts.</p>
        </div>
        <ConnectAccountButton className="w-56" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 p-4 rounded-xl border border-default">
              <Skeleton className="w-10 h-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Failed to load accounts" onRetry={refetch} />
      ) : !accounts?.length ? (
        <div className="flex flex-col items-center justify-center py-16 border border-dashed border-default rounded-xl">
          <Users className="w-8 h-8 text-secondary mb-2" />
          <p className="text-sm text-muted">No accounts connected</p>
          <p className="text-xs text-secondary mt-1">Use Connect account above to add one.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
