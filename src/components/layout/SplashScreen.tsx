"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogoMark } from "@/components/kit/Logo";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/SessionStoreProvider";
import { accountsQuery } from "@/modules/accounts/hooks/useAccounts";

// Shown when the app first loads (it's in the server HTML, so the half-loaded page never flashes).
// Meanwhile it loads what the first screens need into the cache: this week's plan, notifications,
// connected accounts and automation settings. Then it fades out. At least a short moment so it
// doesn't blink, at most a few seconds so a slow call never holds the app.

const MIN_MS = 650;
const MAX_MS = 3000;
const FADE_MS = 380;

const STEPS = ["Loading your week", "Checking what the agents did", "Connecting your accounts", "Almost ready"];

export function SplashScreen() {
  const queryClient = useQueryClient();
  const businessName = useSession((s) => s.business.name);
  const [phase, setPhase] = useState<"show" | "leaving" | "gone">("show");
  const [done, setDone] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const loads = [
      queryClient.prefetchQuery({ queryKey: ["plan", "this"], queryFn: () => apiFetch("/api/plans?week=this") }),
      queryClient.prefetchQuery({ queryKey: ["notifications"], queryFn: () => apiFetch("/api/notifications") }),
      queryClient.prefetchQuery(accountsQuery),
      queryClient.prefetchQuery({ queryKey: ["settings", "automation"], queryFn: () => apiFetch("/api/settings/automation") }),
    ].map((p) => p.finally(() => !cancelled && setDone((n) => n + 1)));

    const minimum = new Promise((r) => setTimeout(r, MIN_MS));
    const cap = new Promise((r) => setTimeout(r, MAX_MS));
    Promise.race([Promise.all([Promise.allSettled(loads), minimum]), cap]).then(() => {
      if (cancelled) return;
      setPhase("leaving");
      setTimeout(() => !cancelled && setPhase("gone"), FADE_MS);
    });
    return () => {
      cancelled = true;
    };
  }, [queryClient]);

  if (phase === "gone") return null;
  const progress = Math.max(12, Math.round((done / 4) * 100));

  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading Prodo"
      className={cn(
        "fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-ob-bg font-ob text-ob-ink transition-opacity ease-out",
        phase === "leaving" && "pointer-events-none opacity-0"
      )}
      style={{ transitionDuration: `${FADE_MS}ms` }}
    >
      {/* Soft brand glow behind the mark */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(40%_35%_at_50%_45%,var(--color-ob-primary-soft),transparent)]" aria-hidden="true" />

      <div className="relative flex flex-col items-center gap-5 duration-500 animate-in fade-in zoom-in-90 motion-reduce:animate-none">
        <div className="relative">
          <span className="absolute inset-0 animate-ping rounded-[26px] bg-ob-ink/15 [animation-duration:1.8s] motion-reduce:hidden" aria-hidden="true" />
          <LogoMark size={76} className="relative drop-shadow-[0_12px_28px_rgb(0_0_0/0.25)]" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[26px] font-extrabold tracking-tight">Prodo</span>
          {businessName && <span className="text-sm font-semibold text-ob-muted">{businessName}</span>}
        </div>
      </div>

      <div className="relative flex w-[220px] flex-col items-center gap-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-ob-line">
          <div className="h-full rounded-full bg-ob-primary transition-[width] duration-500 ease-out" style={{ width: `${progress}%` }} />
        </div>
        <span key={done} className="text-[13px] text-ob-muted duration-300 animate-in fade-in slide-in-from-bottom-1 motion-reduce:animate-none">
          {STEPS[Math.min(done, STEPS.length - 1)]}…
        </span>
      </div>
    </div>
  );
}
