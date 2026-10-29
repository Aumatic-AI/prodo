"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { useUnsavedSteps } from "../../hooks/useUnsavedSteps";
import { useWebsiteScan } from "../../hooks/useWebsiteScan";
import { Logo, LogoMark } from "@/components/kit/Logo";
import { StepTrack, Stepper } from "./Stepper";
import { AccountButton } from "./AccountButton";

/** Top bar, stepper and the page. Warns before leaving with unsaved edits. */
export function OnboardingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const saving = useOnboarding((s) => s.saving);
  const dirty = useUnsavedSteps().length > 0;
  useWebsiteScan();
  const submitted = pathname.endsWith("/progress") || pathname.endsWith("/bible");
  // The website start screen comes before the numbered steps
  const start = pathname.endsWith("/website");
  const steps = !submitted && !start;

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <>
      <header className={cn("sticky top-0 z-20 bg-ob-surface/90 backdrop-blur-md", !steps && "border-b border-ob-line")}>
        {/* Logo far left, steps in the middle, save state and account far right */}
        <div className="flex min-h-[60px] items-center justify-between gap-3 px-4 py-2 sm:gap-5 sm:px-7">
          <div className="flex flex-1 items-center">
            {/* Just the mark on phones, so the steps fit */}
            <span className={steps ? "sm:hidden" : "hidden"}>
              <LogoMark size={28} />
            </span>
            <Logo className={steps ? "hidden sm:inline-flex" : undefined} />
          </div>
          {steps && <Stepper />}
          <div className="flex flex-1 items-center justify-end gap-3.5">
            {!submitted && (
              <span className="hidden items-center gap-1.5 whitespace-nowrap text-[13px] text-ob-muted md:inline-flex" aria-live="polite">
                {saving ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <span className={cn("size-[7px] rounded-full", dirty ? "bg-ob-warn" : "bg-ob-success")} />
                )}
                {saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
              </span>
            )}
            <AccountButton />
          </div>
        </div>
        {steps && <StepTrack />}
      </header>
      {children}
    </>
  );
}
