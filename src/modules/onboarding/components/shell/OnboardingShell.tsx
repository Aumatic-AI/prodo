"use client";

import { useEffect, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSession } from "@/stores/SessionStoreProvider";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { useUnsavedSteps } from "../../hooks/useUnsavedSteps";
import { container } from "@/components/kit/styles";
import { Logo } from "@/components/kit/Logo";
import { Stepper } from "./Stepper";

/** Top bar, stepper and the page. Warns before leaving with unsaved edits. */
export function OnboardingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const businessName = useSession((s) => s.business.name);
  const saving = useOnboarding((s) => s.saving);
  const dirty = useUnsavedSteps().length > 0;
  const submitted = pathname.endsWith("/progress") || pathname.endsWith("/bible");

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-ob-line bg-ob-surface/90 backdrop-blur-md">
        <div className={cn(container, "flex items-center justify-between gap-4 py-3")}>
          <Logo />
          <div className="flex items-center gap-3.5">
            {!submitted && (
              <span className="hidden items-center gap-1.5 text-[13px] text-ob-muted sm:inline-flex" aria-live="polite">
                {saving ? (
                  <Loader2 size={13} className="animate-spin" aria-hidden="true" />
                ) : (
                  <span className={cn("size-[7px] rounded-full", dirty ? "bg-ob-warn" : "bg-ob-success")} />
                )}
                {saving ? "Saving…" : dirty ? "Unsaved changes" : "All changes saved"}
              </span>
            )}
            {businessName && <span className="hidden text-[13px] text-ob-muted md:inline">{businessName}</span>}
          </div>
        </div>
        {!submitted && <Stepper />}
      </header>
      {children}
    </>
  );
}
