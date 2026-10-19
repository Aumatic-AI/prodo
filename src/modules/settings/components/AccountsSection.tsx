"use client";

import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Button } from "@/components/ui/Button";
import { useAccounts } from "@/modules/accounts/hooks/useAccounts";
import { cn } from "@/lib/utils";
import { ExternalLink, Plus, Users } from "lucide-react";

function connectAccount() {
  window.open("https://app.upload-post.com", "_blank", "noopener,noreferrer");
}

const platformColors: Record<string, string> = {
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500",
  facebook: "bg-blue-600",
  linkedin: "bg-blue-700",
  twitter: "bg-black",
  tiktok: "bg-black",
};

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
            <div
              key={account.id}
              className="flex items-center gap-3 p-3 bg-page rounded-lg border border-default hover:border-[var(--color-border-strong)] transition-colors"
            >
              <div
                className={cn(
                  "w-9 h-9 rounded-lg flex items-center justify-center text-white text-xs font-bold shrink-0",
                  platformColors[account.platform] || "bg-surface-sunken text-muted"
                )}
              >
                {account.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{account.name}</p>
                <p className="text-xs text-secondary capitalize">{account.platform}</p>
              </div>
              {account.profileUrl && (
                <a
                  href={account.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-muted hover:text-primary transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
