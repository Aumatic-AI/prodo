"use client";

import { cn } from "@/lib/utils";
import { ExternalLink } from "lucide-react";

interface AccountCardProps {
  account: {
    id: string;
    platform: string;
    name: string;
    profileUrl?: string;
    avatarUrl?: string;
  };
}

const platformColors: Record<string, string> = {
  instagram: "bg-gradient-to-br from-purple-500 to-pink-500",
  facebook: "bg-blue-600",
  linkedin: "bg-blue-700",
  twitter: "bg-black",
  tiktok: "bg-black",
};

export function AccountCard({ account }: AccountCardProps) {
  return (
    <div className="flex items-center gap-4 p-4 bg-surface rounded-xl border border-default shadow-xs hover:shadow-sm transition-shadow">
      <div
        className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center text-white text-sm font-bold",
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
          className="p-2 text-muted hover:text-primary transition-colors"
        >
          <ExternalLink className="w-4 h-4" />
        </a>
      )}
    </div>
  );
}
