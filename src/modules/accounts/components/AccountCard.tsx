"use client";

import { platformMeta } from "@/modules/dashboard/lib/platforms";

interface AccountCardProps {
  account: {
    id: string;
    platform: string;
    name: string;
    profileUrl?: string;
    avatarUrl?: string;
  };
}

export function AccountCard({ account }: AccountCardProps) {
  const meta = platformMeta(account.platform);
  const Icon = meta?.icon;

  const content = (
    <>
      <div
        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
        style={{ backgroundColor: meta?.color || "var(--color-surface-sunken)" }}
      >
        {Icon ? (
          <Icon className="w-5 h-5 text-white" />
        ) : (
          <span className="text-sm font-bold text-muted">{account.name.charAt(0).toUpperCase()}</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text truncate">{account.name}</p>
        <p className="text-xs text-secondary">{meta?.label || account.platform}</p>
      </div>
    </>
  );

  const className =
    "flex items-center gap-4 p-4 bg-surface rounded-xl border border-default shadow-xs hover:shadow-sm transition-shadow";

  if (account.profileUrl) {
    return (
      <a href={account.profileUrl} target="_blank" rel="noopener noreferrer" className={className}>
        {content}
      </a>
    );
  }

  return <div className={className}>{content}</div>;
}
