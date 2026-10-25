"use client";

import { useState } from "react";
import { Dropdown } from "@/components/ui/Dropdown";
import { PLATFORMS } from "@/config/platforms";
import { openConnectLink } from "../hooks/useAccounts";

const OPTIONS = Object.entries(PLATFORMS).map(([value, p]) => ({ value, label: p.label }));

/** Pick a platform, then sign in on that platform's own page. */
export function ConnectAccountButton({ className }: { className?: string }) {
  const [error, setError] = useState<string | null>(null);

  async function connect(platform: string) {
    setError(null);
    try {
      await openConnectLink(platform);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't open the connect page");
    }
  }

  return (
    <div className={className}>
      <Dropdown options={OPTIONS} value="" onChange={connect} placeholder="Connect account" />
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
