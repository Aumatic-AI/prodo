"use client";

import { useState } from "react";
import { CheckCircle2, ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { POSTING_PLATFORMS, type PostingPlatform } from "@/core/onboarding/options";
import { Alert } from "@/components/kit/Alert";
import { PlatformIcon } from "@/components/kit/PlatformIcon";
import { button } from "@/components/kit/styles";
import { openConnectLink, useAccounts } from "../hooks/useAccounts";

const LABELS: Record<PostingPlatform, string> = {
  instagram: "Instagram",
  facebook: "Facebook",
  youtube: "YouTube",
  linkedin: "LinkedIn",
  tiktok: "TikTok",
  twitter: "X",
};

/** Every platform Prodo posts to, with its connected account or a Connect button. Used in onboarding and Settings. */
export function AccountsList({ planned }: { planned?: Partial<Record<PostingPlatform, number>> }) {
  const { data: accounts = [], isLoading, error, refetch, isFetching } = useAccounts();
  const [opening, setOpening] = useState<string | null>(null);
  const [connectError, setConnectError] = useState<string | null>(null);

  async function connect(platform: string) {
    setConnectError(null);
    setOpening(platform);
    try {
      await openConnectLink(platform);
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Couldn't open the connect page");
    } finally {
      setOpening(null);
    }
  }

  if (error) return <Alert tone="error">{error.message}</Alert>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[13px] text-ob-muted">{isLoading ? "Checking your accounts…" : `${accounts.length} connected`}</span>
        <button type="button" className={button({ variant: "quiet", size: "xs" })} onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw size={14} className={isFetching ? "animate-spin" : undefined} />
          Refresh
        </button>
      </div>
      <ul className="m-0 flex list-none flex-col divide-y divide-ob-line rounded-ob-md border border-ob-line p-0">
        {POSTING_PLATFORMS.map((platform) => {
          const connected = accounts.filter((a) => a.platform === platform);
          const perWeek = planned?.[platform] ?? 0;
          return (
            <li key={platform} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5">
              <span className="flex min-w-0 items-center gap-3">
                <PlatformIcon platform={platform} />
                <span className="flex min-w-0 flex-col">
                  <strong className="text-[15px]">{LABELS[platform]}</strong>
                  <span className="truncate text-[13px] text-ob-muted">
                    {connected.length ? connected.map((a) => a.name).join(", ") : perWeek ? `${perWeek} posts a week planned` : "Not connected"}
                  </span>
                </span>
              </span>
              {isLoading ? (
                <Loader2 size={18} className="animate-spin text-ob-muted" aria-label="Loading" />
              ) : connected.length ? (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-ob-success-soft px-2.5 py-1 text-[13px] font-semibold text-ob-success">
                  <CheckCircle2 size={14} />
                  Connected
                </span>
              ) : (
                <button type="button" className={button({ variant: perWeek ? "primary" : "secondary", size: "sm" })} disabled={opening === platform} onClick={() => connect(platform)}>
                  {opening === platform ? <Loader2 size={15} className="animate-spin" /> : <ExternalLink size={15} />}
                  Connect
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {connectError && <Alert tone="error">{connectError}</Alert>}
    </div>
  );
}
