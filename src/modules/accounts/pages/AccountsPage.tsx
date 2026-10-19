"use client";

import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { AccountCard } from "../components/AccountCard";
import { useAccounts } from "../hooks/useAccounts";
import { Plus, Users } from "lucide-react";

export function AccountsPage() {
  const { data: accounts, isLoading, error, refetch } = useAccounts();

  function handleConnect() {
    window.open("https://app.upload-post.com", "_blank", "noopener,noreferrer");
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-text">Accounts</h1>
          <p className="mt-1 text-sm text-muted">Your connected social accounts, live from Upload-Post.</p>
        </div>
        <Button size="sm" onClick={handleConnect}>
          <Plus className="w-4 h-4" />
          Connect account
        </Button>
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
        <EmptyState
          icon={Users}
          title="No accounts connected"
          description="Connect your social accounts on Upload-Post to start publishing."
          actionLabel="Connect account"
          onAction={handleConnect}
        />
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
