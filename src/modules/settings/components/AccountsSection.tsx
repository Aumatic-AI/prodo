"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { AccountCard } from "@/modules/accounts/components/AccountCard";
import { useAccounts } from "@/modules/accounts/hooks/useAccounts";
import { Plus, Users } from "lucide-react";

function connectAccount() {
  window.open("https://app.upload-post.com", "_blank", "noopener,noreferrer");
}

export function AccountsSection() {
  const { data: accounts, isLoading, error, refetch } = useAccounts();

  return (
    <div className="bg-surface rounded-xl border border-default shadow-xs p-6">
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-default">
              <Skeleton className="w-9 h-9 rounded-lg" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3.5 w-24" />
                <Skeleton className="h-3 w-16" />
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <ErrorState message="Failed to load accounts" onRetry={refetch} />
      ) : !accounts?.length ? (
        <div className="flex flex-col items-center justify-center py-10 border border-dashed border-default rounded-xl">
          <Users className="w-8 h-8 text-secondary mb-2" />
          <p className="text-sm text-muted">No accounts connected yet.</p>
          <p className="text-xs text-secondary mt-1 mb-4">Connect your social accounts on Upload-Post to start publishing.</p>
          <Button size="sm" onClick={connectAccount}>
            <Plus className="w-4 h-4" />
            Connect account
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  );
}
