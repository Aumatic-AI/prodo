"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { NUMBERED_STEPS, nextStep, prevStep, stepNumber, type StepKey } from "@/core/onboarding/steps";
import { useOnboarding } from "../../store/OnboardingStoreProvider";
import { useStepSave } from "../../hooks/useStepSave";
import { usePrefetchStep } from "../../hooks/usePrefetchStep";
import { button, container } from "@/components/kit/styles";

interface StepLayoutProps {
  step: StepKey;
  title: string;
  lead: string;
  children: ReactNode;
  /** Replaces the default "Save & continue" action (used on Review) */
  primaryAction?: ReactNode;
}

/** Heading, one form column, and the sticky Back / Continue bar. */
export function StepLayout({ step, title, lead, children, primaryAction }: StepLayoutProps) {
  const router = useRouter();
  const save = useStepSave(step);
  const saving = useOnboarding((s) => s.saving);
  const saveError = useOnboarding((s) => s.saveError);
  const prefetch = usePrefetchStep();
  const back = prevStep(step);
  const next = nextStep(step);

  // Warm the next step's data while the client fills this one
  useEffect(() => {
    prefetch(next);
  }, [prefetch, next]);

  async function onContinue() {
    // In parallel with the save; refetches only if the cached copy went stale
    prefetch(next);
    if ((await save()) && next) router.push(`/onboarding/${next}`);
  }

  return (
    <>
      <div className={cn(container, "pb-28 pt-8")}>
        <main className="mx-auto flex w-full max-w-[860px] min-w-0 flex-col gap-5">
          <div className="mb-1 flex flex-col gap-1.5">
            <span className="text-[13px] font-bold uppercase tracking-[0.06em] text-ob-primary">
              Step {stepNumber(step)} of {NUMBERED_STEPS.length}
            </span>
            <h1 className="m-0 text-[32px] font-extrabold leading-tight tracking-tight">{title}</h1>
            <p className="m-0 max-w-[640px] text-base text-ob-muted">{lead}</p>
          </div>
          {children}
        </main>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-ob-line bg-ob-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md">
        <div className={cn(container, "flex items-center justify-between gap-3 py-2.5")}>
          {back ? (
            <button type="button" className={cn(button({ variant: "secondary" }), "min-h-10")} onClick={() => router.push(`/onboarding/${back}`)}>
              <ArrowLeft size={16} />
              Back
            </button>
          ) : (
            <span />
          )}
          {saveError && (
            <span className="min-w-0 flex-1 text-right text-sm text-ob-danger" role="alert">
              {saveError}
            </span>
          )}
          {primaryAction ?? (
            <button type="button" className={cn(button(), "min-h-10")} disabled={saving} onClick={onContinue}>
              {saving && <Loader2 size={16} className="animate-spin" />}
              Save &amp; continue
              {!saving && <ArrowRight size={16} />}
            </button>
          )}
        </div>
      </div>
    </>
  );
}
